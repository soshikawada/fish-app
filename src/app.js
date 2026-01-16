/**
 * Fish Intelligence Dashboard - Core Logic
 */

const App = {
    state: {
        manifest: null,
        data: {
            marketLatest: [],
            marketLatestCat: [],
            marketYearly: [],
            marketYearFishCat: [],
            landingsYearly: [],
            landingsMonthly: [],
            marketOrigin: [],
            marketTopOrigin: [],
            landingsLatest: [],
            landingsTopArea: [],
            landingsTopMethod: [],
            landingsMonthArea: [],
            landingsMonthMethod: [],
            correlations: []
        },
        currView: 'watchlist',
        currCategory: 'all',
        selectedFish: null,
        range: '5Y',
        sortMode: 'rank_amt',
        landingsGrain: 'yearly',
        lastListView: 'watchlist',
        currDetailTab: 'area',
        detailFilter: { type: 'all', value: null }
    },

    getThemeColors() {
        const isKids = document.body.classList.contains('kids-mode');
        return {
            text: isKids ? '#475569' : '#94a3b8',
            grid: isKids ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
            primary: isKids ? '#0ea5e9' : '#38bdf8',
            secondary: isKids ? '#6366f1' : 'rgba(129, 140, 248, 0.4)',
            accent: isKids ? '#f59e0b' : '#fbbf24'
        };
    },

    async init() {
        console.log("Initializing App...");
        try {
            const response = await fetch('data/pro_data/manifest.json');
            this.state.manifest = await response.json();
            
            await this.loadInitialData();
            this.setupEventListeners();
            this.renderWatchlist();
            
            if (window.lucide) lucide.createIcons();
        } catch (error) {
            console.error("Initialization failed:", error);
        }
    },

    async loadInitialData() {
        console.log("Loading initial data...");
        const files = this.state.manifest.files;
        
        const [marketLatest, marketLatestCat, marketYearly, marketYearFishCat, landingsLatest, landingsYearly, landingsMonthly, marketOrigin, marketTopOrigin, corrFish, landingsTopArea, landingsTopMethod, landingsMonthArea, landingsMonthMethod] = await Promise.all([
            this.fetchCSV(`data/pro_data/${files.marketTopFishLatest}`),
            this.fetchCSV(`data/pro_data/${files.marketTopFishLatestByCategory}`),
            this.fetchCSV(`data/pro_data/${files.marketYearFish}`),
            this.fetchCSV(`data/pro_data/${files.marketYearFishCategory}`),
            this.fetchCSV(`data/pro_data/${files.landingsTopFishLatest}`),
            this.fetchCSV(`data/pro_data/${files.landingsYearFish}`),
            this.fetchCSV(`data/pro_data/${files.landingsMonthFish}`),
            this.fetchCSV(`data/pro_data/${files.marketYearFishOriginTop}`),
            this.fetchCSV(`data/pro_data/${files.marketYearFishTopOrigin}`),
            this.fetchCSV(`data/pro_data/${files.corrFish}`),
            this.fetchCSV(`data/pro_data/${files.landingsYearFishAreaTop}`),
            this.fetchCSV(`data/pro_data/${files.landingsYearFishMethodTop}`),
            this.fetchCSV(`data/pro_data/${files.landingsMonthFishArea}`),
            this.fetchCSV(`data/pro_data/${files.landingsMonthFishMethod}`)
        ]);

        this.state.data.marketLatest = marketLatest;
        this.state.data.marketLatestCat = marketLatestCat;
        this.state.data.marketYearly = marketYearly;
        this.state.data.marketYearFishCat = marketYearFishCat;
        this.state.data.landingsLatest = landingsLatest;
        this.state.data.landingsYearly = landingsYearly;
        this.state.data.landingsMonthly = landingsMonthly;
        this.state.data.marketOrigin = marketOrigin;
        this.state.data.marketTopOrigin = marketTopOrigin || [];
        this.state.data.landingsTopArea = landingsTopArea || [];
        this.state.data.landingsTopMethod = landingsTopMethod || [];
        this.state.data.landingsMonthArea = landingsMonthArea || [];
        this.state.data.landingsMonthMethod = landingsMonthMethod || [];
        this.state.data.correlations = corrFish;
    },

    fetchCSV(url) {
        return new Promise((resolve) => {
            Papa.parse(url, {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (error) => {
                    console.warn(`Failed to load ${url}:`, error);
                    resolve([]);
                }
            });
        });
    },

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('[data-view]').forEach(el => {
            el.addEventListener('click', (e) => {
                this.switchView(e.currentTarget.dataset.view);
            });
        });

        // Mobile Nav
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', (e) => {
                this.switchView(e.currentTarget.dataset.view);
            });
        });

        // Search
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchQuery = e.target.value.toLowerCase();
                if (this.state.currView === 'watchlist') this.renderWatchlist();
                if (this.state.currView === 'landings-list') this.renderLandingsList();
            });
        }

        // Range filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.range = e.target.dataset.range;
                
                if (this.state.currView === 'detail' && this.state.selectedFish) {
                    this.renderCharts(this.state.selectedFish);
                    this.renderSeasonality(this.state.selectedFish);
                }
                if (this.state.currView === 'watchlist') this.renderWatchlist();
                if (this.state.currView === 'landings-list') this.renderLandingsList();
            });
        });

        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Back button
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.switchView(this.state.lastListView || 'watchlist');
            });
        }

        // Category Tabs
        document.querySelectorAll('#category-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#category-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.currCategory = e.target.dataset.category;
                this.renderWatchlist();
            });
        });

        // Landings Sort
        const lSortSelect = document.getElementById('landings-sort-select');
        if (lSortSelect) {
            lSortSelect.addEventListener('change', () => this.renderLandingsList());
        }

        // Sorting (Watchlist)
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.state.sortMode = e.target.value;
                this.renderWatchlist();
            });
        }

        // Detail Card Tabs
        document.querySelectorAll('.card-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                document.querySelectorAll('.card-tab').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                this.state.currDetailTab = tab;
                if (this.state.selectedFish) {
                    this.renderDetailStats(this.state.selectedFish);
                }
            });
        });
    },

    switchView(viewId) {
        if (viewId === 'watchlist' || viewId === 'landings-list') {
            this.state.lastListView = viewId;
        }
        this.state.currView = viewId;
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) targetView.classList.add('active');
        
        document.querySelectorAll('.nav-links li, .nav-item').forEach(li => {
            li.classList.toggle('active', li.dataset.view === viewId);
        });

        // Toggle global filter visibility
        const filterGroup = document.querySelector('.filter-group');
        if (filterGroup) {
            filterGroup.style.display = (viewId === 'watchlist' || viewId === 'detail') ? 'flex' : 'none';
        }

        if (viewId === 'overview') this.renderOverview();
        if (viewId === 'watchlist') this.renderWatchlist();
        if (viewId === 'landings-list') this.renderLandingsList();
        
        window.scrollTo(0, 0);
    },

    renderWatchlist() {
        const container = document.getElementById('watchlist-items');
        if (!container) return;

        let items = this.state.currCategory === 'all' 
            ? [...this.state.data.marketLatest] 
            : this.state.data.marketLatestCat.filter(item => item.category === this.state.currCategory);

        if (this.state.searchQuery) {
            const q = this.state.searchQuery;
            items = items.filter(item => {
                const nameMatch = (item.fish_label && item.fish_label.toLowerCase().includes(q)) ||
                                 (item.fish_key && item.fish_key.toLowerCase().includes(q));
                
                // Check origins for this fish
                const origins = this.state.data.marketTopOrigin.filter(d => d.fish_key === item.fish_key);
                const originMatch = origins.some(d => 
                    (d.top_amt_origin_pref && d.top_amt_origin_pref.toLowerCase().includes(q)) ||
                    (d.top_qty_origin_pref && d.top_qty_origin_pref.toLowerCase().includes(q))
                );

                return nameMatch || originMatch;
            });
        }

        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state">一致するおさかなが見つかりませんでした</div>`;
            return;
        }

        // Sort items
        const sm = this.state.sortMode;
        if (sm === 'rank_amt') items.sort((a,b) => a.rank_amt - b.rank_amt);
        else if (sm === 'price_asc') items.sort((a,b) => a.latest_price - b.latest_price);
        else if (sm === 'price_desc') items.sort((a,b) => b.latest_price - a.latest_price);
        else if (sm === 'yoy_desc') items.sort((a,b) => (b.yoy_price||0) - (a.yoy_price||0));
        else if (sm === 'yoy_asc') items.sort((a,b) => (a.yoy_price||0) - (b.yoy_price||0));

        const latestYear = this.state.manifest.latestMarketYear || 2024;
        const totalMarketAmt = items.reduce((sum, item) => sum + (item.latest_amt || 0), 0);

        container.innerHTML = items.map(item => {
            const fishKey = item.fish_key;
            const price = Math.round(item.latest_price).toLocaleString();
            const yoyValue = item.yoy_price;
            const yoy = yoyValue !== null && !isNaN(yoyValue) ? (yoyValue * 100).toFixed(1) : '---';
            const yoyClass = yoyValue >= 0 ? 'up' : 'down';
            const yoyIcon = yoyValue >= 0 ? '↑' : '↓';
            const share = ((item.latest_amt / totalMarketAmt) * 100).toFixed(2);
            
            const topOrigins = this.state.data.marketTopOrigin.find(d => d.fish_key === fishKey && d.year === latestYear);
            const amtOrigin = topOrigins ? topOrigins.top_amt_origin_pref : '不明';
            const qtyOrigin = topOrigins ? topOrigins.top_qty_origin_pref : '不明';

            return `
                <div class="fish-card" data-key="${fishKey}">
                    <div class="fish-card-header">
                        <div class="fish-name-block">
                            <div class="fish-name">${item.fish_label}</div>
                            <div class="category-badge">${item.category || ''}</div>
                        </div>
                        <div class="fish-price-info">
                            <span class="price-label">ねだん (1kg)</span>
                            <div class="latest-price">¥${price}</div>
                            <div class="price-change ${yoyClass}">${yoyIcon} ${yoy} %</div>
                        </div>
                    </div>
                    <div class="fish-sparkline-container">
                        <canvas id="sparkline-${fishKey}" class="fish-sparkline"></canvas>
                    </div>
                    <div class="fish-card-metrics">
                        <div class="metric-item"><div class="metric-label">売上シェア率</div><div class="metric-value">${share}%</div></div>
                        <div class="metric-item"><div class="metric-label">漁獲量</div><div class="metric-value">${(item.latest_qty / 10000).toFixed(1)}万t</div></div>
                        <div class="metric-item"><div class="metric-label">売れてる産地</div><div class="metric-value">${amtOrigin}</div></div>
                        <div class="metric-item"><div class="metric-label">仕入れ量の多い産地</div><div class="metric-value">${qtyOrigin}</div></div>
                    </div>
                </div>
            `;
        }).join('');

        requestAnimationFrame(() => {
            items.forEach(item => {
                let hist = this.state.data.marketYearly.filter(d => d.fish_key === item.fish_key).sort((a,b) => a.year - b.year);
                hist = this.filterByRange(hist);
                const colors = this.getThemeColors();
                if (hist.length > 0) this.renderSparkline(`sparkline-${item.fish_key}`, hist, 'price', colors.primary);
            });
        });

        container.querySelectorAll('.fish-card').forEach(card => {
            card.addEventListener('click', () => this.showDetail(card.dataset.key));
        });
    },

    async renderLandingsList() {
        console.log("Rendering landings list (Dual-Row Spec)...");
        const containerHeatmap = document.getElementById('landings-main-heatmap');
        const containerTop = document.getElementById('landings-top-items');
        const ctxTrend = document.getElementById('landings-total-trend-chart');

        if (!containerHeatmap || !containerTop || !ctxTrend) return;

        const allMonthly = this.state.data.landingsMonthly;
        const allYearly = this.state.data.landingsYearly;
        const latestYear = this.state.manifest.latestLandingsYear || 2024;

        // --- 1. ヒートマップ (Fish x Month x 2 Rows) ---
        const fishMonthlyMap = {};
        allMonthly.forEach(d => {
            if (!fishMonthlyMap[d.fish_key]) {
                fishMonthlyMap[d.fish_key] = { 
                    label: d.fish_label, 
                    monthsQty: Array(12).fill(0),
                    monthsPriceSum: Array(12).fill(0),
                    monthsPriceCount: Array(12).fill(0)
                };
            }
            fishMonthlyMap[d.fish_key].monthsQty[d.month - 1] += d.qty || 0;
            // 単価計算 (月間合計で単価を算出するか、平均を取るか。ここでは月別の単純平均)
            if (d.qty > 0 && d.amt > 0) {
                fishMonthlyMap[d.fish_key].monthsPriceSum[d.month - 1] += (d.amt / d.qty);
                fishMonthlyMap[d.fish_key].monthsPriceCount[d.month - 1] += 1;
            }
        });

        const latestLYear = this.state.manifest.latestLandingsYear || 2025;
        const latestYearlyMap = {};
        allYearly.filter(y => y.year === latestLYear).forEach(d => {
            latestYearlyMap[d.fish_key] = d.qty;
        });

        const sortedFishKeys = Object.keys(fishMonthlyMap).sort((a, b) => {
            const qtyA = latestYearlyMap[a] || 0;
            const qtyB = latestYearlyMap[b] || 0;
            return qtyB - qtyA;
        });

        // Filter by Search Query
        let filteredKeys = sortedFishKeys;
        if (this.state.searchQuery) {
            const q = this.state.searchQuery;
            filteredKeys = sortedFishKeys.filter(key => {
                const data = fishMonthlyMap[key];
                const nameMatch = (data.label && data.label.toLowerCase().includes(q)) ||
                                 (key.toLowerCase().includes(q));
                
                // Check areas
                const areas = (this.state.data.landingsTopArea || []).filter(d => d.fish_key === key);
                const areaMatch = areas.some(d => d.area && d.area.toLowerCase().includes(q));

                // Check methods
                const methods = (this.state.data.landingsTopMethod || []).filter(d => d.fish_key === key);
                const methodMatch = methods.some(d => d.method && d.method.toLowerCase().includes(q));

                return nameMatch || areaMatch || methodMatch;
            });
        }

        if (filteredKeys.length === 0) {
            containerHeatmap.innerHTML = `<div class="empty-state">一致するおさかなが見つかりませんでした</div>`;
            containerTop.innerHTML = '';
            if (window.landingsTrendChart) window.landingsTrendChart.destroy();
            return;
        }

        let heatmapHtml = `
            <div class="heatmap-header-row">
                <div class="heatmap-fish-label" style="text-align: right">魚種 / 月</div>
                ${Array.from({length: 12}, (_, i) => `<div class="heatmap-header-label">${i+1}月</div>`).join('')}
            </div>
        `;

        filteredKeys.forEach(key => {
            const data = fishMonthlyMap[key];
            const maxQty = Math.max(...data.monthsQty, 1);
            const avgPrices = data.monthsPriceSum.map((sum, i) => data.monthsPriceCount[i] > 0 ? sum / data.monthsPriceCount[i] : 0);
            const maxPrice = Math.max(...avgPrices, 1);

            heatmapHtml += `
                <div class="heatmap-fish-group" data-key="${key}">
                    <div class="heatmap-label-block">
                        <div class="heatmap-fish-label">${data.label}</div>
                        <div class="heatmap-sublabel-hint">お値段 (価格)</div>
                    </div>
                    <div class="heatmap-data-block">
                        <div class="heatmap-row qty-row">
                            ${data.monthsQty.map(qty => {
                                let intensity = 0;
                                if (qty > 0) intensity = Math.ceil((qty / maxQty) * 5);
                                return `<div class="heatmap-cell-main ${intensity > 0 ? 'intensity-' + intensity : ''}" title="${data.label} (量): ${Math.round(qty/1000)}t"></div>`;
                            }).join('')}
                        </div>
                        <div class="heatmap-row price-row">
                            ${avgPrices.map(price => {
                                let intensity = 0;
                                if (price > 0) intensity = Math.ceil((price / maxPrice) * 5);
                                return `<div class="heatmap-cell-main ${intensity > 0 ? 'intensity-p-' + intensity : ''}" title="${data.label} (価格): ¥${Math.round(price).toLocaleString()}"></div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        containerHeatmap.innerHTML = heatmapHtml;

        // ヒートマップのグループクリックで詳細へ
        containerHeatmap.querySelectorAll('.heatmap-fish-group').forEach(group => {
            group.addEventListener('click', () => this.showDetail(group.dataset.key));
        });

        // --- 2. 最新ランキング ---
        const topItems = allYearly.filter(d => d.year === latestYear).sort((a,b) => b.qty - a.qty).slice(0, 5);
        containerTop.innerHTML = topItems.map((item, idx) => `
            <div class="rank-item" data-key="${item.fish_key}" style="cursor: pointer">
                <div class="rank-number">${idx + 1}</div>
                <div class="rank-info">
                    <div class="rank-name">${item.fish_label}</div>
                    <div class="rank-val">水揚げ量: ${(item.qty / 1000).toLocaleString()} t</div>
                </div>
            </div>
        `).join('');

        containerTop.querySelectorAll('.rank-item').forEach(item => {
            item.addEventListener('click', () => this.showDetail(item.dataset.key));
        });

        // --- 3. 年次推移 ---
        const yearlyTotal = {};
        allYearly.forEach(d => {
            yearlyTotal[d.year] = (yearlyTotal[d.year] || 0) + (d.qty || 0);
        });
        const trendLabels = Object.keys(yearlyTotal).sort();
        const trendValues = trendLabels.map(year => yearlyTotal[year] / 1000);

        if (window.landingsTrendChart) window.landingsTrendChart.destroy();
        const colors = this.getThemeColors();
        window.landingsTrendChart = new Chart(ctxTrend.getContext('2d'), {
            type: 'bar',
            data: {
                labels: trendLabels.map(y => `${y}年`),
                datasets: [{
                    label: '全魚種 合計水揚げ量 (t)',
                    data: trendValues,
                    backgroundColor: colors.secondary,
                    borderColor: colors.primary,
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { display: false } },
                    y: { 
                        ticks: { color: colors.text }, 
                        grid: { color: colors.grid },
                        title: { display: true, text: '水揚げ量 (t)', color: colors.text }
                    }
                }
            }
        });
    },

    /**
     * @param {string} canvasId 
     * @param {Array} data 
     * @param {string} key 'price' or 'qty'
     * @param {string} color 
     */
    renderSparkline(canvasId, data, key = 'price', color = '#38bdf8') {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.year),
                datasets: [{
                    data: data.map(d => d[key]),
                    borderColor: color,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: true, ticks: { color: '#64748b', font: { size: 8 }, maxRotation: 0 }, grid: { display: false } },
                    y: { display: true, ticks: { color: '#64748b', font: { size: 8 } }, grid: { color: this.getThemeColors().grid } }
                }
            }
        });
    },



    /**
     * @param {string} fishKey 
     */
    async showDetail(fishKey) {
        this.state.selectedFish = fishKey;
        this.switchView('detail');
        const fish = this.state.data.marketLatest.find(f => f.fish_key === fishKey) || 
                     this.state.data.landingsLatest.find(f => f.fish_key === fishKey);
        
        document.getElementById('detail-fish-name').textContent = fish ? fish.fish_label : fishKey;
        
        const corr = this.state.data.correlations.find(c => c.fish_key === fishKey);
        const correlBadge = document.getElementById('detail-correl');
        if (corr) {
            const score = corr.corr_price;
            let level = score > 0.7 ? 'とっても関係があるよ！' : (score > 0.4 ? 'ちょっと関係があるよ' : 'あまり関係ないかも');
            correlBadge.textContent = `${level} (スコア: ${score})`;
            correlBadge.className = `correl-badge ${score > 0.7 ? 'strong' : (score > 0.4 ? 'moderate' : '')}`;
        } else {
            correlBadge.textContent = '関係のデータがありません';
            correlBadge.className = 'correl-badge';
        }

        // Context-aware Visibility Logic
        const isFromLandings = this.state.lastListView === 'landings-list';
        const chartCard = document.getElementById('detail-chart-card');
        const landingsChartCard = document.getElementById('detail-landings-chart-card');
        const heatmapCard = document.getElementById('detail-heatmap-card');
        const statsCard = document.getElementById('detail-stats-card');
        const tabContainer = document.getElementById('detail-card-tabs');
        const titleContainer = document.getElementById('detail-card-title');
        const drilldownContainer = document.getElementById('landings-drilldown-container');
        const landingsYearlyChartCard = document.getElementById('detail-landings-yearly-chart-card');

        // Reset filter
        this.state.detailFilter = { type: 'all', value: null };

        if (isFromLandings) {
            // "Landings" entry: Focus on catch data
            if (chartCard) chartCard.style.display = 'none';
            if (landingsChartCard) landingsChartCard.style.display = 'block';
            if (heatmapCard) heatmapCard.style.display = 'block';
            if (statsCard) statsCard.style.display = 'block';
            if (tabContainer) tabContainer.style.display = 'flex';
            if (titleContainer) titleContainer.style.display = 'none';
            if (drilldownContainer) drilldownContainer.style.display = 'flex';
            if (landingsYearlyChartCard) landingsYearlyChartCard.style.display = 'block';
            
            this.renderDrillDownTabs(fishKey);
            this.renderLandingsYearlyChart(fishKey);
            this.renderLandingsChart(fishKey);
            
            const statsList = document.getElementById('detail-stats-list');
            if (statsList) statsList.style.marginTop = '0';
            this.state.currDetailTab = 'area'; // Default to Area
            // Show all tabs
            document.querySelectorAll('.card-tab').forEach(t => t.style.display = 'block');
        } else {
            // "Oshakana Ichiba" (Watchlist) entry: Focus on Market data
            if (chartCard) chartCard.style.display = 'block';
            if (landingsChartCard) landingsChartCard.style.display = 'none';
            if (landingsYearlyChartCard) landingsYearlyChartCard.style.display = 'none';
            if (heatmapCard) heatmapCard.style.display = 'none';
            if (statsCard) statsCard.style.display = 'block';
            if (tabContainer) tabContainer.style.display = 'none';
            if (titleContainer) titleContainer.style.display = 'none';
            if (drilldownContainer) drilldownContainer.style.display = 'none';
            
            this.renderCharts(fishKey);

            const statsList = document.getElementById('detail-stats-list');
            if (statsList) statsList.style.marginTop = '1.5rem';
            this.state.currDetailTab = 'origin'; // Force to Supplier
        }

        this.renderSeasonality(fishKey);
        this.updateDetailTabsUI();
        this.renderDetailStats(fishKey);
    },

    updateDetailTabsUI() {
        const tabs = document.querySelectorAll('.card-tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === this.state.currDetailTab));
    },

    renderLandingsYearlyChart(fishKey) {
        let yearlyData = [];
        if (this.state.detailFilter.type === 'area') {
            yearlyData = this.state.data.landingsMonthArea.filter(d => d.fish_key === fishKey && d.area === this.state.detailFilter.value);
        } else if (this.state.detailFilter.type === 'method') {
            yearlyData = this.state.data.landingsMonthMethod.filter(d => d.fish_key === fishKey && d.method === this.state.detailFilter.value);
        } else {
            yearlyData = this.state.data.landingsMonthly.filter(d => d.fish_key === fishKey);
        }

        // Aggregate by year
        const yearMap = {};
        yearlyData.forEach(d => {
            if (!yearMap[d.year]) yearMap[d.year] = { qty: 0, amt: 0 };
            yearMap[d.year].qty += (d.qty || 0);
            yearMap[d.year].amt += (d.amt || 0);
        });

        const sortedYears = Object.keys(yearMap).sort((a,b) => a-b);
        const labels = sortedYears.map(y => `${y}年`);
        const qtyValues = sortedYears.map(y => yearMap[y].qty);
        const priceValues = sortedYears.map(y => yearMap[y].qty > 0 ? yearMap[y].amt / yearMap[y].qty : 0);

        const ctxElement = document.getElementById('landings-yearly-trend-chart');
        if (!ctxElement) return;
        const ctx = ctxElement.getContext('2d');
        if (window.landingsYearlyChartInstance) window.landingsYearlyChartInstance.destroy();

        const colors = this.getThemeColors();
        window.landingsYearlyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '漁獲量 (t)',
                        data: qtyValues,
                        backgroundColor: colors.secondary,
                        borderColor: colors.primary,
                        borderWidth: 1,
                        yAxisID: 'y-qty'
                    },
                    {
                        type: 'line',
                        label: '価格 (円/kg)',
                        data: priceValues,
                        borderColor: colors.accent,
                        backgroundColor: 'transparent',
                        yAxisID: 'y-price',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                    'y-qty': { position: 'left', title: { display: true, text: '漁獲量 (t)', color: colors.primary }, ticks: { color: colors.text }, grid: { color: colors.grid } },
                    'y-price': { position: 'right', title: { display: true, text: '価格 (円/kg)', color: colors.accent }, grid: { drawOnChartArea: false }, ticks: { color: colors.text } },
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } }
                }
            }
        });
    },

    renderCharts(fishKey) {
        const marketDataRaw = this.state.data.marketYearly.filter(d => d.fish_key === fishKey);
        const marketData = this.filterByRange(marketDataRaw);
        
        const ctx = document.getElementById('market-chart').getContext('2d');
        if (window.marketChartInstance) window.marketChartInstance.destroy();

        const colors = this.getThemeColors();
        window.marketChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: marketData.map(d => `${d.year}年`),
                datasets: [
                    {
                        label: 'ねだん (円/kg)',
                        data: marketData.map(d => d.price),
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + '1a', // 10% opacity
                        yAxisID: 'y-price',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        type: 'bar',
                        label: '売れた量 (t)',
                        data: marketData.map(d => d.qty / 1000),
                        backgroundColor: colors.accent + '66', // 40% opacity
                        borderColor: colors.accent,
                        borderWidth: 1,
                        yAxisID: 'y-qty'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                    'y-price': { 
                        position: 'left', 
                        title: { display: true, text: 'ねだん', color: colors.primary }, 
                        grid: { color: colors.grid }, 
                        ticks: { color: colors.text },
                        grace: '50%'
                    },
                    'y-qty': { 
                        position: 'right', 
                        title: { display: true, text: '売れた量', color: colors.accent }, 
                        grid: { drawOnChartArea: false }, 
                        ticks: { color: colors.text },
                        grace: '50%'
                    },
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } }
                }
            }
        });
    },

    renderLandingsChart(fishKey) {
        let monthlyData = [];
        if (this.state.detailFilter.type === 'area') {
            monthlyData = this.state.data.landingsMonthArea.filter(d => d.fish_key === fishKey && d.area === this.state.detailFilter.value);
        } else if (this.state.detailFilter.type === 'method') {
            monthlyData = this.state.data.landingsMonthMethod.filter(d => d.fish_key === fishKey && d.method === this.state.detailFilter.value);
        } else {
            monthlyData = this.state.data.landingsMonthly.filter(d => d.fish_key === fishKey);
        }
        
        // Filter by range (e.g. 5Y)
        const latestYear = Math.max(...this.state.data.landingsYearly.map(d => d.year), 2025);
        if (this.state.range !== 'MAX') {
            const rangeYears = { '5Y': 5, '10Y': 10 }[this.state.range];
            monthlyData = monthlyData.filter(d => d.year > latestYear - rangeYears);
        }
        
        // Sort chronologically
        monthlyData.sort((a,b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));

        const ctxElement = document.getElementById('landings-monthly-chart');
        if (!ctxElement) return;
        const ctx = ctxElement.getContext('2d');
        if (window.landingsChartInstance) window.landingsChartInstance.destroy();

        const colors = this.getThemeColors();
        window.landingsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.map(d => `${d.year}/${d.month}`),
                datasets: [
                    {
                        label: '価格 (円/kg)',
                        data: monthlyData.map(d => d.qty > 0 ? d.amt / d.qty : 0),
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + '1a',
                        yAxisID: 'y-price',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        type: 'bar',
                        label: '漁獲量 (t)',
                        data: monthlyData.map(d => d.qty),
                        backgroundColor: colors.accent + '66',
                        borderColor: colors.accent,
                        borderWidth: 1,
                        yAxisID: 'y-qty'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                    'y-price': { 
                        position: 'left', 
                        title: { display: true, text: '価格', color: colors.primary }, 
                        grid: { color: colors.grid }, 
                        ticks: { color: colors.text },
                        grace: '50%'
                    },
                    'y-qty': { 
                        position: 'right', 
                        title: { display: true, text: '漁獲量', color: colors.accent }, 
                        grid: { drawOnChartArea: false }, 
                        ticks: { color: colors.text },
                        grace: '50%'
                    },
                    x: { ticks: { color: colors.text, font: { size: 10 } }, grid: { color: colors.grid } }
                }
            }
        });
    },

    renderDrillDownTabs(fishKey) {
        const cAll = document.getElementById('drilldown-tabs-all');
        const cArea = document.getElementById('drilldown-tabs-area');
        const cMethod = document.getElementById('drilldown-tabs-method');
        if (!cAll || !cArea || !cMethod) return;

        cAll.innerHTML = '';
        cArea.innerHTML = '';
        cMethod.innerHTML = '';

        // All (全合計)
        const btnAll = document.createElement('button');
        btnAll.className = `drilldown-tab ${this.state.detailFilter.type === 'all' ? 'active' : ''}`;
        btnAll.textContent = '全合計';
        btnAll.onclick = () => this.setDetailFilter('all', null);
        cAll.appendChild(btnAll);

        // Areas (地区別)
        const areaData = this.state.data.landingsMonthArea.filter(d => d.fish_key === fishKey);
        const areaMap = {};
        areaData.forEach(d => {
            if (!areaMap[d.area]) areaMap[d.area] = 0;
            areaMap[d.area] += (d.qty || 0);
        });

        const areas = Object.keys(areaMap).filter(a => areaMap[a] > 0).sort();
        
        areas.forEach(a => {
            const btn = document.createElement('button');
            btn.className = `drilldown-tab ${this.state.detailFilter.type === 'area' && this.state.detailFilter.value === a ? 'active' : ''}`;
            btn.textContent = a;
            btn.onclick = () => this.setDetailFilter('area', a);
            cArea.appendChild(btn);
        });

        // Methods (漁法別)
        const methodData = this.state.data.landingsMonthMethod.filter(d => d.fish_key === fishKey);
        const methodMap = {};
        methodData.forEach(d => {
            if (!methodMap[d.method]) methodMap[d.method] = 0;
            methodMap[d.method] += (d.qty || 0);
        });

        const methods = Object.keys(methodMap).filter(m => methodMap[m] > 0).sort();

        methods.forEach(m => {
            const btn = document.createElement('button');
            btn.className = `drilldown-tab ${this.state.detailFilter.type === 'method' && this.state.detailFilter.value === m ? 'active' : ''}`;
            btn.textContent = m;
            btn.onclick = () => this.setDetailFilter('method', m);
            cMethod.appendChild(btn);
        });
    },

    setDetailFilter(type, value) {
        this.state.detailFilter = { type, value };
        this.renderDrillDownTabs(this.state.selectedFish);
        this.renderLandingsYearlyChart(this.state.selectedFish);
        this.renderLandingsChart(this.state.selectedFish);
        this.renderSeasonality(this.state.selectedFish);
        // Stats card reset to appropriate tab or update based on filter?
        // Let's keep stats card as is for now, but usually it should also reflect.
    },

    renderSeasonality(fishKey) {
        const container = document.getElementById('landings-heatmap');
        if (!container) return;
        
        let data = [];
        if (this.state.detailFilter.type === 'area') {
            data = this.state.data.landingsMonthArea.filter(d => d.fish_key === fishKey && d.area === this.state.detailFilter.value);
        } else if (this.state.detailFilter.type === 'method') {
            data = this.state.data.landingsMonthMethod.filter(d => d.fish_key === fishKey && d.method === this.state.detailFilter.value);
        } else {
            data = this.state.data.landingsMonthly.filter(d => d.fish_key === fishKey);
        }

        if (data.length === 0) { container.innerHTML = 'データがありません'; return; }

        // Filter by range
        const latestYear = Math.max(...this.state.data.landingsYearly.map(d => d.year));
        if (this.state.range !== 'MAX') {
            const years = { '5Y': 5, '10Y': 10 }[this.state.range];
            data = data.filter(d => d.year > latestYear - years);
        }

        const yearMap = {};
        data.forEach(d => {
            if (!yearMap[d.year]) {
                yearMap[d.year] = {
                    qty: Array(12).fill(0),
                    priceSum: Array(12).fill(0),
                    priceCount: Array(12).fill(0)
                };
            }
            yearMap[d.year].qty[d.month - 1] = d.qty;
            if (d.qty > 0 && d.amt > 0) {
                yearMap[d.year].priceSum[d.month - 1] += (d.amt / d.qty);
                yearMap[d.year].priceCount[d.month - 1] += 1;
            }
        });

        const allQtys = data.map(d => d.qty);
        const maxQty = Math.max(...allQtys, 1);
        
        // Calculate all prices to find max price
        let allPrices = [];
        data.forEach(d => {
           if (d.qty > 0 && d.amt > 0) allPrices.push(d.amt / d.qty);
        });
        const maxPrice = Math.max(...allPrices, 1);

        const years = Object.keys(yearMap).sort((a, b) => a - b);
        
        // Helper to format numbers compactly
        const fmtQty = (val) => {
            if (val === 0) return '';
            if (val >= 1000) return (val/1000).toFixed(1) + 'k';
            return Math.round(val);
        };
        const fmtPrice = (val) => {
            if (val === 0) return '';
            if (val >= 10000) return (val/10000).toFixed(1) + '万';
            if (val >= 1000) return (val/1000).toFixed(1) + 'k';
            return Math.round(val);
        };

        const renderCell = (val, max, type) => {
            let intensity = val > 0 ? Math.ceil((val / max) * 5) : 0;
            let formatted = type === 'qty' ? fmtQty(val) : fmtPrice(val);
            let colorClass = type === 'qty' ? (intensity > 0 ? `intensity-${intensity}` : '') : (intensity > 0 ? `intensity-p-${intensity}` : '');
            return `<div class="heatmap-cell ${colorClass}" title="${type === 'qty' ? '量: '+val.toLocaleString()+'t' : '単価: '+Math.round(val).toLocaleString()+'円'}">${formatted}</div>`;
        };

        let html = `
            <div class="heatmap-header-row details-header">
                <div class="heatmap-year-label">年度 / 月</div>
                ${Array.from({length: 12}, (_, i) => `<div class="heatmap-header-label">${i+1}月</div>`).join('')}
            </div>
        `;

        years.forEach(year => {
            const yData = yearMap[year];
            const avgPrices = yData.priceSum.map((sum, i) => yData.priceCount[i] > 0 ? sum / yData.priceCount[i] : 0);
            
            html += `
                <div class="heatmap-year-group-detail">
                    <div class="heatmap-year-label-col">${year}</div>
                    <div class="heatmap-data-rows-detail">
                        <div class="heatmap-row-detail qty">
                            ${yData.qty.map(q => renderCell(q, maxQty, 'qty')).join('')}
                        </div>
                        <div class="heatmap-row-detail price">
                            ${avgPrices.map(p => renderCell(p, maxPrice, 'price')).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    renderDetailStats(fishKey) {
        const container = document.getElementById('detail-stats-list');
        if (!container) return;

        const tab = this.state.currDetailTab; // 'origin', 'area', 'method'
        const latestMarketYear = this.state.manifest.latestMarketYear || 2024;
        const latestLandingsYear = this.state.manifest.latestLandingsYear || 2025;
        
        // Define data source and fields based on tab
        let data = [];
        let nameField = '';
        let itemLabel = '';

        if (tab === 'origin') {
            data = this.state.data.marketOrigin.filter(d => d.fish_key === fishKey && d.year === latestMarketYear);
            nameField = 'origin_pref';
            itemLabel = '主な市場（県）';
        } else if (tab === 'area') {
            data = this.state.data.landingsTopArea.filter(d => d.fish_key === fishKey && d.year === latestLandingsYear);
            nameField = 'area';
            itemLabel = '主な地区（港）';
        } else if (tab === 'method') {
            data = this.state.data.landingsTopMethod.filter(d => d.fish_key === fishKey && d.year === latestLandingsYear);
            nameField = 'method';
            itemLabel = 'とり方（漁法）';
        }

        if (!data || data.length === 0) {
            container.innerHTML = `<li><div style="padding:1rem; color:var(--text-secondary); text-align:center;">データがありません</div></li>`;
            return;
        }

        // Sort by amount desc
        data.sort((a, b) => b.amt - a.amt);

        const maxAmt = Math.max(...data.map(o => o.amt), 1);
        const maxQty = Math.max(...data.map(o => o.qty), 1);

        container.innerHTML = data.map(o => {
            return `<li>
                <div class="stat-info">
                    <span class="stat-name">${o[nameField]}</span>
                    <div class="stat-metrics">
                        <span class="stat-val amt">金: ${Math.round(o.amt/10000).toLocaleString()}万円</span>
                        <span class="stat-val qty">量: ${Math.round(o.qty).toLocaleString()}t</span>
                    </div>
                </div>
                <div class="stat-bar-container-double">
                    <div class="stat-bar-combined">
                        <div class="stat-bar amt" style="width: ${(o.amt/maxAmt)*100}%"></div>
                        <div class="stat-bar qty" style="width: ${(o.qty/maxQty)*100}%"></div>
                    </div>
                </div>
            </li>`;
        }).join('');
    },

    filterByRange(data) {
        if (this.state.range === 'MAX') return data;
        const years = { '5Y': 5, '10Y': 10 }[this.state.range];
        const latest = Math.max(...this.state.data.marketYearly.map(d => d.year));
        return data.filter(d => d.year > latest - years);
    },

    async renderOverview() {
        const shareData = await this.fetchCSV(`data/pro_data/${this.state.manifest.files.marketYearCategoryShare}`);
        const latestYear = this.state.manifest.latestMarketYear || 2024;
        const latestShare = shareData.filter(d => d.year === latestYear);
        const totalAmt = latestShare.reduce((sum, d) => sum + d.amt, 0);
        document.getElementById('total-market-amt').textContent = `約 ¥${Math.round(totalAmt/1000000).toLocaleString()}M（メガ＝百万円）`;

        const ctx = document.getElementById('category-share-chart').getContext('2d');
        if (window.shareChartInstance) window.shareChartInstance.destroy();
        const colors = this.getThemeColors();
        window.shareChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: latestShare.map(d => d.category),
                datasets: [{ data: latestShare.map(d => d.amt), backgroundColor: [colors.primary, colors.secondary, colors.accent], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: colors.text } } } }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
