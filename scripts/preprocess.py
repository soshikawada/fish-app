import pandas as pd
import numpy as np
import os
import json
import jaconv
import re
from unicodedata import normalize

# 設定
RAW_DIR = "data/raw_data"
PRO_DIR = "data/pro_data"
os.makedirs(PRO_DIR, exist_ok=True)

MARKET_FILE = os.path.join(RAW_DIR, "中央卸売市場_(2000-2024).xlsx")
LANDINGS_FILE = os.path.join(RAW_DIR, "2025.12.18.xlsx")

def normalize_fish_name(name):
    if not isinstance(name, str):
        return ""
    # NFKC正規化
    name = normalize('NFKC', name)
    # 記号除去
    name = re.sub(r'[()（）　\s\[\]【】、。・/／]', '', name)
    # カタカナをひらがなに変換
    name = jaconv.kata2hira(name)
    return name

def normalize_pref(name):
    if not isinstance(name, str):
        return ""
    # NFKC正規化とトリミング
    name = normalize('NFKC', name).strip()
    
    # 海外・輸入対応
    if any(x in name for x in ["外国", "輸入", "海外", "アメリカ", "中国", "ロシア", "ノルウェー", "チリ", "インド", "タイ", "ベトナム"]):
        return "海外"

    # 都道府県表記に寄せる
    prefs_map = {"東京": "東京都", "大阪": "大阪府", "京都": "京都府", "北海道": "北海道"}
    if name in prefs_map:
        return prefs_map[name]
    
    if name.endswith(("都", "道", "府", "県")):
        return name
    
    # 一般県名に「県」を付与
    standard_prefs = [
        "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬", "埼玉", "千葉", "神奈川",
        "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知", "三重", "滋賀", "兵庫",
        "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡",
        "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"
    ]
    if name in standard_prefs:
        return name + "県"

    return name

def extract_latest_by_category(market_cat_df, label_map):
    print("Extracting latest snapshots by category...")
    latest_year = market_cat_df['year'].max()
    curr_df = market_cat_df[market_cat_df['year'] == latest_year].copy()
    prev_df = market_cat_df[market_cat_df['year'] == latest_year - 1].copy()
    
    results = []
    for cat in curr_df['category'].unique():
        cat_curr = curr_df[curr_df['category'] == cat].copy()
        cat_prev = prev_df[prev_df['category'] == cat].copy()
        
        # カテゴリ内順位（金額順）
        cat_curr = cat_curr.sort_values('amt', ascending=False)
        cat_curr['rank_amt'] = range(1, len(cat_curr) + 1)
        
        # 前年比計算
        cat_prev_map = cat_prev.set_index('fish_key')['price'].to_dict()
        
        for _, row in cat_curr.iterrows():
            fk = row['fish_key']
            prev_price = cat_prev_map.get(fk, np.nan)
            yoy = (row['price'] / prev_price - 1) if pd.notnull(prev_price) and prev_price > 0 else np.nan
            
            results.append({
                'category': cat,
                'fish_key': fk,
                'fish_label': label_map.get(fk, fk),
                'latest_year': latest_year,
                'latest_price': row['price'],
                'yoy_price': yoy,
                'latest_qty': row['qty'],
                'latest_amt': row['amt'],
                'rank_amt': row['rank_amt']
            })
            
    res_df = pd.DataFrame(results)
    res_df.to_csv(os.path.join(PRO_DIR, "market_top_fish_latest_by_category.csv"), index=False, encoding='utf-8')
    return res_df

def extract_top_origins(market_raw, label_map):
    print("Extracting top origins for each fish and year...")
    # 年×魚×産地で集計（全件）
    df = market_raw.groupby(['year', 'fish_key', 'origin_pref']).agg({'qty': 'sum', 'amt': 'sum'}).reset_index()
    df = clean_negatives(df) # 負値除外
    
    results = []
    for (year, fish_key), group in df.groupby(['year', 'fish_key']):
        # 金額トップ
        # タイブレーク: 1) qty降順 2) origin_pref昇順
        top_amt_row = group.sort_values(['amt', 'qty', 'origin_pref'], ascending=[False, False, True]).iloc[0]
        
        # 数量トップ
        # タイブレーク: 1) amt降順 2) origin_pref昇順
        top_qty_row = group.sort_values(['qty', 'amt', 'origin_pref'], ascending=[False, False, True]).iloc[0]
        
        res = {
            'year': year,
            'fish_key': fish_key,
            'fish_label': label_map.get(fish_key, ""),
            'top_amt_origin_pref': top_amt_row['origin_pref'],
            'top_amt_amt': top_amt_row['amt'],
            'top_amt_qty': top_amt_row['qty'],
            'top_amt_price': top_amt_row['price'],
            'top_qty_origin_pref': top_qty_row['origin_pref'],
            'top_qty_qty': top_qty_row['qty'],
            'top_qty_amt': top_qty_row['amt'],
            'top_qty_price': top_qty_row['price']
        }
        results.append(res)
    
    top_origin_df = pd.DataFrame(results)
    top_origin_df.to_csv(os.path.join(PRO_DIR, "market_year_fish_top_origin.csv"), index=False, encoding='utf-8')
    return top_origin_df

def get_fish_label_map(market_df, landings_df):
    """fish_keyに対する代表的なfish_labelを生成する"""
    # 市場データと水揚げデータを統合して、最も頻出する名称か、最初に見つかった名称をラベルとする
    m_labels = market_df[['fish_key', 'fish_label']].drop_duplicates()
    l_labels = landings_df[['fish_key', 'fish_label']].drop_duplicates()
    combined = pd.concat([m_labels, l_labels]).drop_duplicates(subset=['fish_key'])
    return combined.set_index('fish_key')['fish_label'].to_dict()

def add_yoy(df, key_cols=['fish_key'], value_cols=['price', 'qty']):
    """YoY (前年比) を計算して追加する"""
    df = df.sort_values(key_cols + ['year'])
    for col in value_cols:
        df[f'prev_{col}'] = df.groupby(key_cols)[col].shift(1)
        df[f'yoy_{col}'] = np.where(df[f'prev_{col}'] > 0, (df[col] / df[f'prev_{col}']) - 1, np.nan)
        df = df.drop(columns=[f'prev_{col}'])
    return df

def clean_negatives(df):
    """負のqty/amtを除去し、priceを再計算する"""
    # qty < 0 または amt < 0 の行を除外
    df = df[(df['qty'] >= 0) & (df['amt'] >= 0)].copy()
    # qty <= 0 の場合 price は NaN、それ以外は amt / qty
    df['price'] = np.where(df['qty'] > 0, df['amt'] / df['qty'], np.nan)
    return df

def rerank_topn(df, groupby_cols=['year', 'fish_key'], sort_col='amt', rank_col='rank_in_fish_year'):
    """TopNの順位を振り直す"""
    df = df.sort_values(groupby_cols + [sort_col], ascending=[True] * len(groupby_cols) + [False])
    df[rank_col] = df.groupby(groupby_cols).cumcount() + 1
    return df

def process_market_data():
    print("Processing market data...")
    sheets = ["鮮魚データ", "冷凍魚データ", "塩干データ"]
    dfs = []
    
    for sheet in sheets:
        df = pd.read_excel(MARKET_FILE, sheet_name=sheet)
        df['category'] = sheet.replace("データ", "")
        dfs.append(df)
    
    market_df = pd.concat(dfs, ignore_index=True)
    market_df.columns = [c.strip() for c in market_df.columns]
    
    market_df = market_df[['販売年', '品名', '産地', '数量', '金額', 'category']]
    market_df.columns = ['year', 'fish_label', 'origin', 'qty', 'amt', 'category']
    
    # 負値除外（読み込み直後に行う）
    market_df = clean_negatives(market_df)
    
    market_df['fish_key'] = market_df['fish_label'].apply(normalize_fish_name)
    market_df['origin_pref'] = market_df['origin'].apply(normalize_pref)
    
    return market_df

def process_landings_data():
    print("Processing landings data...")
    df = pd.read_excel(LANDINGS_FILE, sheet_name="水揚げデータ")
    df.columns = [c.strip() for c in df.columns]
    
    df['fish_key'] = df['銘柄名'].apply(normalize_fish_name)
    df['fish_label'] = df['銘柄名']
    
    # 数量年計, 金額年計などを正規化して返す
    return df

def finalize_all(market_raw, landings_raw):
    print("Finalizing all files with labels, YoY, and clean data...")
    
    # Label Map
    label_map = get_fish_label_map(market_raw, landings_raw)
    
    def apply_label(df):
        df['fish_label'] = df['fish_key'].map(label_map)
        # fish_key, fish_label を左側に寄せる
        cols = ['fish_key', 'fish_label'] + [c for c in df.columns if c not in ['fish_key', 'fish_label']]
        return df[cols]

    # --- Market Outputs ---
    # ① market_year_fish.csv
    m_year = market_raw.groupby(['year', 'fish_key']).agg({'qty': 'sum', 'amt': 'sum'}).reset_index()
    m_year = clean_negatives(m_year)
    m_year = add_yoy(m_year)
    apply_label(m_year).to_csv(os.path.join(PRO_DIR, "market_year_fish.csv"), index=False, encoding='utf-8')

    # ② market_year_fish_category.csv
    m_cat = market_raw.groupby(['year', 'fish_key', 'category']).agg({'qty': 'sum', 'amt': 'sum'}).reset_index()
    m_cat = clean_negatives(m_cat)
    apply_label(m_cat).to_csv(os.path.join(PRO_DIR, "market_year_fish_category.csv"), index=False, encoding='utf-8')

    # ③ market_year_fish_origin_top.csv
    m_origin = market_raw.groupby(['year', 'fish_key', 'origin_pref']).agg({'qty': 'sum', 'amt': 'sum'}).reset_index()
    m_origin = clean_negatives(m_origin)
    m_origin = rerank_topn(m_origin)
    m_origin = m_origin[m_origin['rank_in_fish_year'] <= 10]
    apply_label(m_origin).to_csv(os.path.join(PRO_DIR, "market_year_fish_origin_top.csv"), index=False, encoding='utf-8')

    # ④ market_year_category_share.csv
    m_share = market_raw.groupby(['year', 'category']).agg({'qty': 'sum', 'amt': 'sum'}).reset_index()
    m_share = clean_negatives(m_share)
    year_totals = m_share.groupby('year').agg({'amt': 'sum', 'qty': 'sum'}).rename(columns={'amt': 'total_amt', 'qty': 'total_qty'})
    m_share = m_share.merge(year_totals, on='year')
    m_share['share_amt'] = m_share['amt'] / m_share['total_amt']
    m_share['share_qty'] = m_share['qty'] / m_share['total_qty']
    m_share.drop(columns=['total_amt', 'total_qty']).to_csv(os.path.join(PRO_DIR, "market_year_category_share.csv"), index=False, encoding='utf-8')

    # ⑤ market_top_fish_latest.csv
    latest_year = m_year['year'].max()
    m_latest = m_year[m_year['year'] == latest_year].copy()
    m_latest['rank_amt'] = m_latest['amt'].rank(ascending=False, method='first')
    m_latest = m_latest.rename(columns={'year': 'latest_year', 'price': 'latest_price', 'qty': 'latest_qty', 'amt': 'latest_amt'})
    apply_label(m_latest).to_csv(os.path.join(PRO_DIR, "market_top_fish_latest.csv"), index=False, encoding='utf-8')

    # --- Landings Outputs ---
    qty_cols = [f"数量{str(i).zfill(2)}月" for i in range(1, 13)]
    amt_cols = [f"金額{str(i).zfill(2)}月" for i in range(1, 13)]

    # ⑥ landings_year_fish.csv
    l_year = landings_raw.groupby(['年', 'fish_key']).agg({'数量年計': 'sum', '金額年計': 'sum'}).reset_index()
    l_year.columns = ['year', 'fish_key', 'qty', 'amt']
    l_year = clean_negatives(l_year)
    apply_label(l_year).to_csv(os.path.join(PRO_DIR, "landings_year_fish.csv"), index=False, encoding='utf-8')

    # ⑦ landings_month_fish.csv
    melted_qty = landings_raw.melt(id_vars=['年', 'fish_key'], value_vars=qty_cols, var_name='month_label', value_name='qty')
    melted_amt = landings_raw.melt(id_vars=['年', 'fish_key'], value_vars=amt_cols, var_name='month_label', value_name='amt')
    melted_qty['month'] = melted_qty['month_label'].str.extract('(\d+)').astype(int)
    melted_amt['month'] = melted_amt['month_label'].str.extract('(\d+)').astype(int)
    monthly = melted_qty.merge(melted_amt, on=['年', 'month', 'fish_key'])
    monthly = monthly.groupby(['年', 'month', 'fish_key']).agg({'qty': 'sum', 'amt': 'sum'}).reset_index()
    monthly.columns = ['year', 'month', 'fish_key', 'qty', 'amt']
    monthly = clean_negatives(monthly)
    apply_label(monthly).to_csv(os.path.join(PRO_DIR, "landings_month_fish.csv"), index=False, encoding='utf-8')

    print("Generating yearly area top...")
    # ⑧ landings_year_fish_area_top.csv
    l_area = landings_raw.groupby(['年', 'fish_key', '地区名']).agg({'数量年計': 'sum', '金額年計': 'sum'}).reset_index()
    print(f"l_area columns: {l_area.columns.tolist()} (len: {len(l_area.columns)})")
    l_area.columns = ['year', 'fish_key', 'area', 'qty', 'amt']
    l_area = clean_negatives(l_area)
    l_area = rerank_topn(l_area)
    l_area = l_area[l_area['rank_in_fish_year'] <= 10]
    apply_label(l_area).to_csv(os.path.join(PRO_DIR, "landings_year_fish_area_top.csv"), index=False, encoding='utf-8')

    print("Generating yearly method top...")
    # ⑨ landings_year_fish_method_top.csv
    l_method = landings_raw.groupby(['年', 'fish_key', '漁名']).agg({'数量年計': 'sum', '金額年計': 'sum'}).reset_index()
    print(f"l_method columns: {l_method.columns.tolist()} (len: {len(l_method.columns)})")
    l_method.columns = ['year', 'fish_key', 'method', 'qty', 'amt']
    l_method = clean_negatives(l_method)
    l_method = rerank_topn(l_method)
    l_method = l_method[l_method['rank_in_fish_year'] <= 10]
    apply_label(l_method).to_csv(os.path.join(PRO_DIR, "landings_year_fish_method_top.csv"), index=False, encoding='utf-8')

    print("Generating drill-down monthly area...")
    # --- Drill-down Monthly Outputs ---
    
    # ⑨-C landings_month_fish_area_top.csv
    l_area_m = landings_raw.groupby(['年', 'fish_key', '地区名'])[qty_cols + amt_cols].sum().reset_index()
    m_qty_area = l_area_m.melt(id_vars=['年', 'fish_key', '地区名'], value_vars=qty_cols, var_name='month_label', value_name='qty')
    m_amt_area = l_area_m.melt(id_vars=['年', 'fish_key', '地区名'], value_vars=amt_cols, var_name='month_label', value_name='amt')
    m_qty_area['month'] = m_qty_area['month_label'].str.extract('(\d+)').astype(int)
    m_amt_area['month'] = m_amt_area['month_label'].str.extract('(\d+)').astype(int)
    
    monthly_area = m_qty_area.merge(m_amt_area, on=['年', 'month', 'fish_key', '地区名'])
    # Select only required columns (avoiding duplicate month_label_x/y)
    monthly_area = monthly_area[['年', 'month', 'fish_key', '地区名', 'qty', 'amt']]
    monthly_area.columns = ['year', 'month', 'fish_key', 'area', 'qty', 'amt']
    monthly_area = clean_negatives(monthly_area)
    
    # Filter to only top 10 areas total per fish to save space
    top_areas = l_area[['fish_key', 'area']].drop_duplicates()
    monthly_area = monthly_area.merge(top_areas, on=['fish_key', 'area'])
    apply_label(monthly_area).to_csv(os.path.join(PRO_DIR, "landings_month_fish_area_top.csv"), index=False, encoding='utf-8')

    print("Generating drill-down monthly method...")
    # ⑨-D landings_month_fish_method_top.csv
    l_meth_m = landings_raw.groupby(['年', 'fish_key', '漁名'])[qty_cols + amt_cols].sum().reset_index()
    m_qty_meth = l_meth_m.melt(id_vars=['年', 'fish_key', '漁名'], value_vars=qty_cols, var_name='month_label', value_name='qty')
    m_amt_meth = l_meth_m.melt(id_vars=['年', 'fish_key', '漁名'], value_vars=amt_cols, var_name='month_label', value_name='amt')
    m_qty_meth['month'] = m_qty_meth['month_label'].str.extract('(\d+)').astype(int)
    m_amt_meth['month'] = m_amt_meth['month_label'].str.extract('(\d+)').astype(int)
    
    monthly_meth = m_qty_meth.merge(m_amt_meth, on=['年', 'month', 'fish_key', '漁名'])
    monthly_meth = monthly_meth[['年', 'month', 'fish_key', '漁名', 'qty', 'amt']]
    monthly_meth.columns = ['year', 'month', 'fish_key', 'method', 'qty', 'amt']
    monthly_meth = clean_negatives(monthly_meth)
    
    # Filter to only top 10 methods total per fish
    top_methods = l_method[['fish_key', 'method']].drop_duplicates()
    monthly_meth = monthly_meth.merge(top_methods, on=['fish_key', 'method'])
    apply_label(monthly_meth).to_csv(os.path.join(PRO_DIR, "landings_month_fish_method_top.csv"), index=False, encoding='utf-8')

    # ⑨-B landings_top_fish_latest.csv (For the new Catch Volume View)
    latest_l_year = l_year['year'].max()
    l_latest = l_year[l_year['year'] == latest_l_year].copy()
    l_latest['rank_qty'] = l_latest['qty'].rank(ascending=False, method='first')
    l_latest = l_latest.rename(columns={'year': 'latest_year', 'qty': 'latest_qty', 'amt': 'latest_amt'})
    apply_label(l_latest).to_csv(os.path.join(PRO_DIR, "landings_top_fish_latest.csv"), index=False, encoding='utf-8')

    # --- Correlation ---
    # ⑩ corr_fish_market_vs_landings.csv
    m_for_corr = m_year[['year', 'fish_key', 'qty', 'amt', 'price']].rename(columns={'qty': 'm_qty', 'amt': 'm_amt', 'price': 'm_price'})
    l_for_corr = l_year[['year', 'fish_key', 'qty', 'amt', 'price']].rename(columns={'qty': 'l_qty', 'amt': 'l_amt', 'price': 'l_price'})
    merged = pd.merge(m_for_corr, l_for_corr, on=['year', 'fish_key'])
    
    corr_results = []
    for fish_key, group in merged.groupby('fish_key'):
        if len(group) >= 5:
            c_qty = group['m_qty'].corr(group['l_qty'])
            c_amt = group['m_amt'].corr(group['l_amt'])
            c_price = group['m_price'].corr(group['l_price'])
            corr_results.append({
                'fish_key': fish_key,
                'n_years': len(group),
                'corr_qty': round(c_qty, 3) if not np.isnan(c_qty) else 0,
                'corr_amt': round(c_amt, 3) if not np.isnan(c_amt) else 0,
                'corr_price': round(c_price, 3) if not np.isnan(c_price) else 0
            })
    corr_df = pd.DataFrame(corr_results)
    if not corr_df.empty:
        apply_label(corr_df).to_csv(os.path.join(PRO_DIR, "corr_fish_market_vs_landings.csv"), index=False, encoding='utf-8')

    # ⑪ market_year_fish_top_origin.csv
    extract_top_origins(market_raw, label_map)

    # ⑫ market_top_fish_latest_by_category.csv
    extract_latest_by_category(m_cat, label_map)

    return label_map

def create_manifest():
    print("Creating manifest.json...")
    manifest = {
        "version": "2.4", # Incremented
        "latestMarketYear": 2024,
        "latestLandingsYear": 2025,
        "files": {
            "marketYearFish": "market_year_fish.csv",
            "marketYearFishCategory": "market_year_fish_category.csv",
            "marketYearFishOriginTop": "market_year_fish_origin_top.csv",
            "marketYearFishTopOrigin": "market_year_fish_top_origin.csv",
            "marketYearCategoryShare": "market_year_category_share.csv",
            "marketTopFishLatest": "market_top_fish_latest.csv",
            "marketTopFishLatestByCategory": "market_top_fish_latest_by_category.csv",
            "landingsTopFishLatest": "landings_top_fish_latest.csv",
            "landingsYearFish": "landings_year_fish.csv",
            "landingsMonthFish": "landings_month_fish.csv",
            "landingsMonthFishArea": "landings_month_fish_area_top.csv",
            "landingsMonthFishMethod": "landings_month_fish_method_top.csv",
            "landingsYearFishAreaTop": "landings_year_fish_area_top.csv",
            "landingsYearFishMethodTop": "landings_year_fish_method_top.csv",
            "corrFish": "corr_fish_market_vs_landings.csv"
        },
        "topN": { "origin": 10, "area": 10, "method": 10 }
    }
    with open(os.path.join(PRO_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    m_raw = process_market_data()
    l_raw = process_landings_data()
    finalize_all(m_raw, l_raw)
    create_manifest()
    print("Done!")
