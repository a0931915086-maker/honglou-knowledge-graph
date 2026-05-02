// 全局变量
let characters = [];
let relationships = [];
let events = [];
let timeline = [];
let currentGraph = null;
let currentSelectedNode = null;

// 数据缓存，用于存储从JSON加载的索引项详细信息
let indexDataCache = {
    persons: [],
    items: [],
    festivals: [],
    poems: [],
    proverbs: []
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载核心数据
    Promise.all([
        fetchData('data/characters.json'),
        fetchData('data/relationships.json'),
        fetchData('data/events.json'),
        fetchData('data/timeline.json')
    ]).then(([chars, rels, evts, tml]) => {
        characters = chars;
        relationships = rels;
        events = evts;
        timeline = tml;
        
        // 将人物数据同步到缓存
        indexDataCache.persons = chars;
        
        // 更新统计数据
        updateStatistics();
        
        // 初始化功能模块
        initNavigation();
        initHomePage();
        initCharacterGraph();
        
        // 容错初始化
        try { initTimeline(); } catch(e) { console.error('时间轴初始化失败:', e); }
        try { initEvents(); } catch(e) { console.error('事件初始化失败:', e); }
        try { initIndex(); } catch(e) { console.error('索引初始化失败:', e); }
        try { initSearch(); } catch(e) { console.error('搜索初始化失败:', e); }
        
        // 初始显示首页
        showSection('home');
    }).catch(error => {
        console.error('加载核心数据失败:', error);
    });
});

// 通用数据加载函数
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.warn(`无法加载文件: ${url}`);
        return [];
    }
}

// 更新首页统计
function updateStatistics() {
    const charCountEl = document.getElementById('character-count');
    const relCountEl = document.getElementById('relationship-count');
    if(charCountEl) charCountEl.textContent = characters.length;
    if(relCountEl) relCountEl.textContent = relationships.length;
}

// 导航逻辑
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            showSection(target);
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');
}

// 首页快速访问
function initHomePage() {
    document.querySelectorAll('.link-card').forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            const navLink = document.querySelector(`.nav-link[href="#${target}"]`);
            if(navLink) navLink.click();
        });
    });
}

// --- 人物图谱逻辑 ---
function initCharacterGraph() {
    const container = document.getElementById('relationship-graph');
    if (!container || characters.length === 0) return;

    const width = container.clientWidth;
    const height = 600;
    container.innerHTML = '';

    const svg = d3.select('#relationship-graph').append('svg')
        .attr('width', width).attr('height', height);
    
    const g = svg.append('g');

    // 缩放
    svg.call(d3.zoom().on('zoom', (event) => g.attr('transform', event.transform)));

    const simulation = d3.forceSimulation(characters)
        .force('link', d3.forceLink(relationships).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = g.append('g').selectAll('line')
        .data(relationships).enter().append('line')
        .attr('stroke', '#999').attr('stroke-opacity', 0.4).attr('stroke-width', 1.5);

    const node = g.append('g').selectAll('g')
        .data(characters).enter().append('g')
        .style('cursor', 'pointer')
        .on('click', (event, d) => showCharacterDetail(d));

    node.append('circle')
        .attr('r', d => d.type === 'main' ? 25 : 18)
        .attr('fill', d => d.type === 'main' ? '#8b0000' : '#d4af37')
        .attr('stroke', '#fff').attr('stroke-width', 2);

    node.append('text')
        .text(d => d.name)
        .attr('text-anchor', 'middle').attr('dy', 35).style('font-size', '12px');

    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

function showCharacterDetail(char) {
    const panel = document.getElementById('character-detail');
    if (!panel) return;
    panel.innerHTML = `
        <div class="character-header">
            <h3>${char.name}</h3>
            <span class="character-badge">${char.family}</span>
        </div>
        <div class="character-info">
            <p><strong>身份：</strong>${char.identity}</p>
            <p><strong>地位：</strong>${char.status || '未知'}</p>
        </div>
        <p style="margin-top:10px; line-height:1.6;">${char.description}</p>
    `;
}

// --- 时间轴逻辑 ---
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;

    const items = new vis.DataSet(timeline.map(t => ({
        id: t.id,
        content: t.event,
        start: `${String(t.year).padStart(4, '0')}-01-01`,
        className: t.type
    })));

    const options = {
        min: '0001-01-01',
        max: '0020-12-31',
        start: '0001-01-01',
        end: '0015-12-31',
        zoomMin: 1000 * 60 * 60 * 24 * 30 // 一个月
    };

    new vis.Timeline(container, items, options);
}

// --- 重要事件逻辑 ---
function initEvents() {
    const container = document.getElementById('events-container');
    if(!container) return;

    container.innerHTML = events.map(e => `
        <div class="event-card" onclick="showEventModalById('${e.id}')">
            <div class="event-category">${e.category}</div>
            <h3>${e.title}</h3>
            <p><i class="fas fa-clock"></i> 第${e.year}年 · ${e.chapter}</p>
        </div>
    `).join('');
}

window.showEventModalById = function(id) {
    const e = events.find(item => item.id == id);
    if(e) showEventModal(e);
};

// --- 核心：分类索引与详情显示 ---
function initIndex() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            loadIndexData(tabId);
        });
    });
    loadIndexData('persons'); // 默认加载人物
}

async function loadIndexData(type) {
    const grid = document.querySelector(`#${type}-tab .index-grid`);
    if(!grid) return;

    // 如果没加载过数据（且不是已有的persons），则加载
    if (type !== 'persons' && (!indexDataCache[type] || indexDataCache[type].length === 0)) {
        indexDataCache[type] = await fetchData(`data/${type}.json`);
    }

    const data = indexDataCache[type];
    
    if(!data || data.length === 0) {
        grid.innerHTML = '<p>暂无数据</p>';
        return;
    }

    grid.innerHTML = data.map(item => {
        let title = item.name || item.title || item.phrase;
        let sub = item.identity || item.author || item.category || item.time || "";
        return `
            <div class="index-item" onclick="showIndexItemDetail('${item.id}', '${type}')">
                <h4>${title}</h4>
                <p>${sub}</p>
            </div>
        `;
    }).join('');
}

// 解决截图中的“详情未显示”问题
window.showIndexItemDetail = function(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if(!modal) return;

    // 从对应的缓存中提取数据
    const list = indexDataCache[itemType] || [];
    const item = list.find(d => d.id == itemId);

    if(!item) return;

    modalTitle.textContent = item.name || item.title || item.phrase || "详情";
    
    let html = "";
    // 根据数据类型，构建不同的详情模板
    switch(itemType) {
        case 'persons':
            html = `
                <div class="detail-content">
                    <p><strong>身份：</strong>${item.identity || '未知'}</p>
                    <p><strong>家族：</strong>${item.family || '未知'}</p>
                    <p><strong>地位：</strong>${item.status || '未知'}</p>
                    <hr style="margin:15px 0; border:0; border-top:1px solid #eee;">
                    <p><strong>描述：</strong></p>
                    <p style="line-height:1.8; text-indent:2em;">${item.description || '暂无描述'}</p>
                </div>
            `;
            break;
        case 'items':
            html = `
                <div class="detail-content">
                    <p><strong>类别：</strong>${item.category}</p>
                    <p><strong>所有者：</strong>${item.owner}</p>
                    <p><strong>相关章节：</strong>${item.chapters ? item.chapters.join(', ') : '见书中'}</p>
                    <hr style="margin:15px 0; border:0; border-top:1px solid #eee;">
                    <p><strong>详细说明：</strong></p>
                    <p style="line-height:1.6;">${item.description}</p>
                    <p style="margin-top:10px; color:#8b0000;"><strong>内涵象征：</strong>${item.significance || '无'}</p>
                </div>
            `;
            break;
        case 'poems':
            html = `
                <div class="detail-content">
                    <p><strong>作者：</strong>${item.author} | <strong>出自章节：</strong>${item.chapter}</p>
                    <div style="background:#fdfcf8; padding:20px; border:1px solid #e0d0b0; margin-top:15px; font-family: 'serif'; white-space: pre-wrap; line-height: 2; text-align: center; max-height:400px; overflow-y:auto;">${item.content}</div>
                </div>
            `;
            break;
        case 'festivals':
            html = `
                <div class="detail-content">
                    <p><strong>时间：</strong>${item.time}</p>
                    <p><strong>习俗描述：</strong>${item.description}</p>
                    <p><strong>涉及事件：</strong>${item.events ? item.events.join('、') : '无'}</p>
                </div>
            `;
            break;
        case 'proverbs':
            html = `
                <div class="detail-content">
                    <p><strong>出处：</strong>${item.source}</p>
                    <p><strong>含义：</strong>${item.meaning}</p>
                    <div style="background:#f4f4f4; padding:15px; border-left:5px solid #8b0000; margin-top:15px; font-style:italic;">
                        "${item.content}"
                    </div>
                </div>
            `;
            break;
    }

    modalBody.innerHTML = html;
    modal.classList.add('active');

    // 绑定模态框关闭
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('active'); };
};

// --- 搜索与模态框通用 ---
function initSearch() {
    const input = document.getElementById('global-search');
    const btn = document.getElementById('search-btn');
    
    const doSearch = () => {
        const query = input.value.trim().toLowerCase();
        if(!query) return;
        const results = characters.filter(c => c.name.includes(query) || c.description.includes(query));
        // 搜索结果简单处理：复用IndexDetail显示第一个结果
        if(results.length > 0) showIndexItemDetail(results[0].id, 'persons');
    };

    btn.onclick = doSearch;
    input.onkeypress = (e) => { if(e.key === 'Enter') doSearch(); };
}

function showEventModal(event) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modalTitle.textContent = event.title;
    modalBody.innerHTML = `
        <p><strong>时间：</strong>第${event.year}年 · ${event.season}</p>
        <p><strong>章节：</strong>${event.chapter}</p>
        <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
        <p>${event.description}</p>
        <p style="margin-top:10px;"><strong>涉及人物：</strong>${event.characters.join('、')}</p>
    `;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
}
