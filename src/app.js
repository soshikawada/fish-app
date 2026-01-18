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
            landingsMonthlyAreaMethod: [], // New
            landingsYearlyAreaTop: [],     // New
            correlations: []
        },
        currView: 'watchlist',
        currCategory: 'all',
        selectedFish: null,
        range: '5Y',
        sortMode: 'rank_amt',
        landingsGrain: 'yearly',
        landingsSortMonth: null,
        landingsSortMetric: 'qty', // 'qty' or 'price'
        lastListView: 'watchlist', // Track which list view was last used
        currDetailTab: 'area',
        landingsDetailArea: 'all', // New state for landings detail filter
        landingsDetailMethod: 'all' // New state for landings detail filter
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
        
        const [marketLatest, marketLatestCat, marketYearly, marketYearFishCat, landingsLatest, landingsYearly, landingsMonthly, marketOrigin, marketTopOrigin, corrFish, landingsTopArea, landingsTopMethod, landingsMonthArea, landingsMonthMethod, landingsMonthlyAreaMethod, landingsYearlyAreaTop] = await Promise.all([
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
            this.fetchCSV(`data/pro_data/${files.landingsMonthFishMethod}`),
            this.fetchCSV(`data/pro_data/${files.landingsMonthFishAreaMethod}`), // New data source
            this.fetchCSV(`data/pro_data/${files.landingsYearFishAreaTop}`) // New data source
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
        this.state.data.landingsMonthlyAreaMethod = landingsMonthlyAreaMethod || []; // Assign new data
        this.state.data.landingsYearlyAreaTop = landingsYearlyAreaTop || []; // Assign new data
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

        // Range filters (Synced across views)
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.target.dataset.range;
                this.state.range = range;
                
                // Sync all range buttons' active state
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.range === range);
                });
                
                if (this.state.currView === 'detail' && this.state.selectedFish) {
                    this.renderCharts(this.state.selectedFish);
                    this.renderSeasonality(this.state.selectedFish);
                    this.renderLandingsYearlyChart(this.state.selectedFish); // Re-render yearly chart for landings
                    this.renderLandingsChart(this.state.selectedFish); // Re-render monthly chart for landings
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
        const sortBtn = document.getElementById('landings-sort-btn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                const monthVal = document.getElementById('landings-sort-month').value;
                const metricVal = document.getElementById('landings-sort-metric').value;
                
                this.state.landingsSortMonth = monthVal ? parseInt(monthVal) : null;
                this.state.landingsSortMetric = metricVal;
                
                this.renderLandingsList();
            });
        }
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

        // Landings Detail Filters (Area/Method)
        const detailFilterArea = document.getElementById('detail-filter-area');
        const detailFilterMethod = document.getElementById('detail-filter-method');

        if (detailFilterArea) {
            detailFilterArea.addEventListener('change', (e) => {
                this.state.landingsDetailArea = e.target.value;
                if (this.state.selectedFish) {
                    this.renderLandingsYearlyChart(this.state.selectedFish);
                    this.renderLandingsChart(this.state.selectedFish);
                    this.renderSeasonality(this.state.selectedFish);
                }
            });
        }
        if (detailFilterMethod) {
            detailFilterMethod.addEventListener('change', (e) => {
                this.state.landingsDetailMethod = e.target.value;
                if (this.state.selectedFish) {
                    this.renderLandingsYearlyChart(this.state.selectedFish);
                    this.renderLandingsChart(this.state.selectedFish);
                    this.renderSeasonality(this.state.selectedFish);
                }
            });
        }
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

        // Toggle global search visibility if needed (filter-group is now per-view)

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
                        <div class="metric-item"><div class="metric-label">最新年の売上シェア率</div><div class="metric-value">${share}%</div></div>
                        <div class="metric-item"><div class="metric-label">最新年の販売量</div><div class="metric-value">${Math.round(item.latest_qty / 1000).toLocaleString()}t</div></div>
                        <div class="metric-item"><div class="metric-label">最新年の売れてる産地</div><div class="metric-value">${amtOrigin}</div></div>
                        <div class="metric-item"><div class="metric-label">最新年の仕入れ量の多い産地</div><div class="metric-value">${qtyOrigin}</div></div>
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

        // --- Sort Logic ---
        if (this.state.landingsSortMonth !== null) {
            const mIdx = this.state.landingsSortMonth - 1;
            const metric = this.state.landingsSortMetric;
            
            filteredKeys.sort((a, b) => {
                const dataA = fishMonthlyMap[a];
                const dataB = fishMonthlyMap[b];
                
                let valA, valB;
                if (metric === 'qty') {
                    valA = dataA.monthsQty[mIdx] || 0;
                    valB = dataB.monthsQty[mIdx] || 0;
                } else {
                    // Average price for that month
                    valA = dataA.monthsPriceCount[mIdx] > 0 ? dataA.monthsPriceSum[mIdx] / dataA.monthsPriceCount[mIdx] : 0;
                    valB = dataB.monthsPriceCount[mIdx] > 0 ? dataB.monthsPriceSum[mIdx] / dataB.monthsPriceCount[mIdx] : 0;
                }
                return valB - valA; // Descending
            });
        }

        let heatmapHtml = `
            <div class="heatmap-header-row">
                <div class="heatmap-header-spacer"></div>
                <div class="heatmap-header-months">
                    ${Array.from({length: 12}, (_, i) => `<div class="heatmap-header-label">${i+1}月</div>`).join('')}
                </div>
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
                        <div class="heatmap-sublabel-hint">（上が量 / 下が価格）</div>
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
                    <div class="rank-val">最新年の水揚げ量: ${(item.qty / 1000).toLocaleString()} t</div>
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
        this.state.landingsDetailArea = 'all';
        this.state.landingsDetailMethod = 'all';

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
            
            // Load multi-filter options
            const amData = this.state.data.landingsMonthlyAreaMethod.filter(d => d.fish_key === fishKey);
            const areas = [...new Set(amData.map(d => d.area))].sort();
            const methods = [...new Set(amData.map(d => d.method))].sort();
            
            const areaSelect = document.getElementById('detail-filter-area');
            const methodSelect = document.getElementById('detail-filter-method');
            
            if (areaSelect) {
                areaSelect.innerHTML = '<option value="all">すべて（全地区）</option>' + 
                    areas.map(a => `<option value="${a}">${a}</option>`).join('');
                areaSelect.value = this.state.landingsDetailArea;
            }
            if (methodSelect) {
                methodSelect.innerHTML = '<option value="all">すべて（全漁法）</option>' + 
                    methods.map(m => `<option value="${m}">${m}</option>`).join('');
                methodSelect.value = this.state.landingsDetailMethod;
            }

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
            
            const statsList = document.getElementById('detail-stats-list');
            if (statsList) statsList.style.marginTop = '1.5rem';
            this.state.currDetailTab = 'origin'; // Force to Supplier
        }

        if (this.state.selectedFish) {
            this.renderCharts(this.state.selectedFish);
            this.renderSeasonality(this.state.selectedFish);
            this.renderLandingsYearlyChart(this.state.selectedFish); // Call for landings yearly chart
            this.renderLandingsChart(this.state.selectedFish); // Call for landings monthly chart
            this.renderDetailStats(this.state.selectedFish);
        }
        this.updateDetailTabsUI();
    },

    updateDetailTabsUI() {
        const tabs = document.querySelectorAll('.card-tab');
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === this.state.currDetailTab));
    },

    renderLandingsYearlyChart(fishKey) {
        // Multi-filtered Yearly Data Calculation
        const rawData = this.state.data.landingsMonthlyAreaMethod.filter(d => d.fish_key === fishKey);
        const filtered = rawData.filter(d => {
            const areaMatch = this.state.landingsDetailArea === 'all' || d.area === this.state.landingsDetailArea;
            const methodMatch = this.state.landingsDetailMethod === 'all' || d.method === this.state.landingsDetailMethod;
            return areaMatch && methodMatch;
        });

        const yearlyMap = {};
        filtered.forEach(d => {
            if (!yearlyMap[d.year]) yearlyMap[d.year] = { qty: 0, amt: 0 };
            yearlyMap[d.year].qty += d.qty;
            yearlyMap[d.year].amt += d.amt;
        });

        const sortedYears = Object.keys(yearlyMap).sort((a,b) => a-b);
        const labels = sortedYears.map(y => `${y}年`);
        const qtyValues = sortedYears.map(y => yearlyMap[y].qty / 1000);
        const priceValues = sortedYears.map(y => yearlyMap[y].qty > 0 ? yearlyMap[y].amt / yearlyMap[y].qty : 0);

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
                    'y-qty': { 
                        position: 'left', 
                        title: { display: true, text: '漁獲量 (t)', color: colors.primary }, 
                        ticks: { 
                            color: colors.text,
                            callback: (val) => val >= 1000 ? (val/1000).toFixed(1) + 'k' : val
                        }, 
                        grid: { color: colors.grid } 
                    },
                    'y-price': { 
                        position: 'right', 
                        title: { display: true, text: '価格', color: colors.accent }, 
                        grid: { drawOnChartArea: false }, 
                        ticks: { 
                            color: colors.text,
                            callback: (val) => val >= 10000 ? (val/10000).toFixed(0) + '万' : val
                        } 
                    },
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
                        label: '販売量 (t)',
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
                        title: { display: true, text: '価格', color: colors.primary }, 
                        grid: { color: colors.grid }, 
                        ticks: { 
                            color: colors.text,
                            callback: (val) => val >= 10000 ? (val/10000).toFixed(0) + '万' : val
                        },
                        grace: '5%'
                    },
                    'y-qty': { 
                        position: 'right', 
                        title: { display: true, text: '量', color: colors.accent }, 
                        grid: { drawOnChartArea: false }, 
                        ticks: { 
                            color: colors.text,
                            callback: (val) => val
                        },
                        grace: '5%'
                    },
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } }
                }
            }
        });
    },

    renderLandingsChart(fishKey) {
        const rawData = this.state.data.landingsMonthlyAreaMethod.filter(d => d.fish_key === fishKey);
        const filtered = rawData.filter(d => {
            const areaMatch = this.state.landingsDetailArea === 'all' || d.area === this.state.landingsDetailArea;
            const methodMatch = this.state.landingsDetailMethod === 'all' || d.method === this.state.landingsDetailMethod;
            return areaMatch && methodMatch;
        });
        
        // Aggregate by month and year
        const monthlyAggregated = {};
        filtered.forEach(d => {
            const key = `${d.year}-${d.month}`;
            if (!monthlyAggregated[key]) {
                monthlyAggregated[key] = { year: d.year, month: d.month, qty: 0, amt: 0 };
            }
            monthlyAggregated[key].qty += d.qty;
            monthlyAggregated[key].amt += d.amt;
        });

        let monthlyData = Object.values(monthlyAggregated);
        
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
                        label: '漁獲量 (t)', // Label changed to reflect tons
                        data: monthlyData.map(d => d.qty / 1000), // Convert to tons
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
                        ticks: { 
                            color: colors.text,
                            callback: (val) => val >= 1000 ? (val/1000).toFixed(1) + 'k' : val
                        },
                        grace: '5%'
                    },
                    'y-qty': { 
                        position: 'right', 
                        title: { display: true, text: '漁獲量 (t)', color: colors.accent }, // Title changed to reflect tons
                        grid: { drawOnChartArea: false }, 
                        ticks: { 
                            color: colors.text,
                            callback: (val) => val >= 100 ? val : val // Now val is already in tons
                        },
                        grace: '5%'
                    },
                    x: { ticks: { color: colors.text, font: { size: 10 } }, grid: { color: colors.grid } }
                }
            }
        });
    },

    renderDrillDownTabs(fishKey) {
        // This function is no longer used with the new multi-filter dropdowns
        // Keeping it for reference or if it's needed elsewhere.
        const cAll = document.getElementById('drilldown-tabs-all');
        const cArea = document.getElementById('drilldown-tabs-area');
        const cMethod = document.getElementById('drilldown-tabs-method');
        if (!cAll || !cArea || !cMethod) return;

        cAll.innerHTML = '';
        cArea.innerHTML = '';
        cMethod.innerHTML = '';

        // All (全合計)
        const btnAll = document.createElement('button');
        btnAll.className = `drilldown-tab ${this.state.landingsDetailArea === 'all' && this.state.landingsDetailMethod === 'all' ? 'active' : ''}`;
        btnAll.textContent = '全合計';
        btnAll.onclick = () => {
            this.state.landingsDetailArea = 'all';
            this.state.landingsDetailMethod = 'all';
            this.renderLandingsYearlyChart(this.state.selectedFish);
            this.renderLandingsChart(this.state.selectedFish);
            this.renderSeasonality(this.state.selectedFish);
            this.renderDrillDownTabs(this.state.selectedFish); // Re-render tabs to update active state
        };
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
            btn.className = `drilldown-tab ${this.state.landingsDetailArea === a && this.state.landingsDetailMethod === 'all' ? 'active' : ''}`;
            btn.textContent = a;
            btn.onclick = () => {
                this.state.landingsDetailArea = a;
                this.state.landingsDetailMethod = 'all';
                this.renderLandingsYearlyChart(this.state.selectedFish);
                this.renderLandingsChart(this.state.selectedFish);
                this.renderSeasonality(this.state.selectedFish);
                this.renderDrillDownTabs(this.state.selectedFish);
            };
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
            btn.className = `drilldown-tab ${this.state.landingsDetailMethod === m && this.state.landingsDetailArea === 'all' ? 'active' : ''}`;
            btn.textContent = m;
            btn.onclick = () => {
                this.state.landingsDetailMethod = m;
                this.state.landingsDetailArea = 'all';
                this.renderLandingsYearlyChart(this.state.selectedFish);
                this.renderLandingsChart(this.state.selectedFish);
                this.renderSeasonality(this.state.selectedFish);
                this.renderDrillDownTabs(this.state.selectedFish);
            };
            cMethod.appendChild(btn);
        });
    },

    setDetailFilter(type, value) {
        // This function is no longer used with the new multi-filter dropdowns
        // Keeping it for reference or if it's needed elsewhere.
        // The new filter logic is handled directly in event listeners for the dropdowns.
    },

    renderSeasonality(fishKey) {
        const container = document.getElementById('landings-heatmap');
        if (!container) return;

        try {
            const rawData = this.state.data.landingsMonthlyAreaMethod.filter(d => d.fish_key === fishKey);
            const filtered = rawData.filter(d => {
                const areaMatch = this.state.landingsDetailArea === 'all' || d.area === this.state.landingsDetailArea;
                const methodMatch = this.state.landingsDetailMethod === 'all' || d.method === this.state.landingsDetailMethod;
                return areaMatch && methodMatch;
            });

            if (filtered.length === 0) { container.innerHTML = '<div class="empty-state">データがありません</div>'; return; }

            // Filter by range
            const latestYear = Math.max(...this.state.data.landingsYearly.map(d => d.year), 2024);
            let rangeFilteredData = filtered;
            if (this.state.range !== 'MAX') {
                const years = { '5Y': 5, '10Y': 10 }[this.state.range];
                rangeFilteredData = filtered.filter(d => d.year > latestYear - years);
            }

            const gridMap = {}; 
            rangeFilteredData.forEach(d => {
                if (!gridMap[d.year]) gridMap[d.year] = {};
                if (!gridMap[d.year][d.month]) gridMap[d.year][d.month] = { qty: 0, amt: 0 };
                gridMap[d.year][d.month].qty += d.qty;
                gridMap[d.year][d.month].amt += d.amt;
            });

            const yearsTotal = Object.keys(gridMap).sort((a, b) => b - a); // Newest first

            const fmtQty = (val) => {
                if (val === 0) return '';
                if (val >= 1000) return (val/1000).toFixed(1) + 't';
                return Math.round(val);
            };
            const fmtPrice = (val) => {
                if (val === 0) return '';
                if (val >= 10000) return (val/10000).toFixed(1) + '万';
                return Math.round(val);
            };

            const renderCell = (val, max, type) => {
                let intensity = val > 0 ? Math.ceil((val / max) * 5) : 0;
                let formatted = type === 'qty' ? fmtQty(val) : fmtPrice(val);
                let colorClass = type === 'qty' ? (intensity > 0 ? `intensity-${intensity}` : '') : (intensity > 0 ? `intensity-p-${intensity}` : '');
                let titleText = type === 'qty' ? `水揚げ量: ${Math.round(val).toLocaleString()}kg` : `単価: ¥${Math.round(val).toLocaleString()}/kg`;
                return `<div class="heatmap-cell ${colorClass}" title="${titleText}">${formatted}</div>`;
            };

            let html = `
                <div class="heatmap-year-group-detail details-header">
                    <div class="heatmap-year-label-col" style="font-size:0.7rem; color:var(--text-secondary)">年度</div>
                    <div class="heatmap-year-label-col"></div>
                    <div class="heatmap-data-rows-detail">
                        <div class="heatmap-row-detail header">
                            ${Array.from({length: 12}, (_, i) => `<div class="heatmap-header-label" style="text-align:center;">${i+1}月</div>`).join('')}
                        </div>
                    </div>
                </div>
            `;

            yearsTotal.forEach(year => {
                const yData = gridMap[year];
                
                // Per-year normalization for better visibility of trends in that specific year
                const rowQtys = Object.values(yData).map(d => d.qty);
                const rowMaxQty = Math.max(...rowQtys, 1);
                
                const rowPrices = Object.values(yData).filter(d => d.qty > 0).map(d => d.amt / d.qty);
                const rowMaxPrice = Math.max(...rowPrices, 1);

                html += `
                    <div class="heatmap-year-group-detail">
                        <div class="heatmap-year-label-col">${year}年</div>
                        <div class="heatmap-row-label-col">
                            <div class="heatmap-row-label">量</div>
                            <div class="heatmap-row-label">単価</div>
                        </div>
                        <div class="heatmap-data-rows-detail">
                            <div class="heatmap-row-detail qty">
                                ${Array.from({length: 12}, (_, i) => {
                                    const m = i + 1;
                                    const qty = (yData[m] && yData[m].qty) ? yData[m].qty : 0;
                                    return renderCell(qty, rowMaxQty, 'qty');
                                }).join('')}
                            </div>
                            <div class="heatmap-row-detail price">
                                ${Array.from({length: 12}, (_, i) => {
                                    const m = i + 1;
                                    const d = yData[m];
                                    const price = (d && d.qty > 0) ? d.amt / d.qty : 0;
                                    return renderCell(price, rowMaxPrice, 'price');
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div style="color:red; padding:1.5rem; text-align:center;">エラー: ${e.message}</div>`;
        }
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
                        <span class="stat-val qty">量: ${Math.round(o.qty / 1000).toLocaleString()}t</span>
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
