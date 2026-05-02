// 全局变量
let characters = [];
let relationships = [];
let events = [];
let timeline = [];
let currentGraph = null;
let currentSelectedNode = null;

// 索引数据缓存
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
        fetchData('data/timeline.json'),
        fetchData('data/items.json'),
        fetchData('data/festivals.json'),
        fetchData('data/poems.json'),
        fetchData('data/proverbs.json')
    ]).then(([chars, rels, evts, tml, items, festivals, poems, proverbs]) => {
        characters = chars;
        relationships = rels;
        events = evts;
        timeline = tml;

        // 填充缓存
        indexDataCache.persons = chars;
        indexDataCache.items = items;
        indexDataCache.festivals = festivals;
        indexDataCache.poems = poems;
        indexDataCache.proverbs = proverbs;
        
        // 更新统计数据
        updateStatistics();
        
        // 初始化各个页面
        initNavigation();
        initHomePage();
        initCharacterGraph(); // 启动人物图谱
        
        try { initTimeline(); } catch(e) { console.error('时间轴初始化跳过:', e); }
        try { initEvents(); } catch(e) { console.error('事件初始化跳过:', e); }
        try { initIndex(); } catch(e) { console.error('索引初始化跳过:', e); }
        try { initSearch(); } catch(e) { console.error('搜索初始化跳过:', e); }
        
        showSection('home');
    }).catch(error => {
        console.error('加载核心数据失败:', error);
        alert('数据加载失败，请检查data文件夹下的JSON文件。');
    });
});

// 数据加载函数
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return []; 
        return await response.json();
    } catch (error) {
        console.warn(`网络请求异常: ${url}`, error);
        return []; 
    }
}

// 更新统计数据
function updateStatistics() {
    document.getElementById('character-count').textContent = characters.length;
    document.getElementById('relationship-count').textContent = relationships.length;
}

// 导航初始化
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

// 显示对应部分
function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add('active');
}

// 首页初始化
function initHomePage() {
    document.querySelectorAll('.link-card').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            const targetLink = document.querySelector(`.nav-link[href="#${target}"]`);
            if(targetLink) targetLink.click();
        });
    });
}

// --- 人物关系图谱核心逻辑 (D3.js) ---
function initCharacterGraph() {
    const graphContainer = document.getElementById('relationship-graph');
    if (!graphContainer || characters.length === 0) return;

    const width = graphContainer.clientWidth || 800;
    const height = 600;
    graphContainer.innerHTML = '';

    const svg = d3.select('#relationship-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');

    // 缩放控制
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // 力学模拟
    const simulation = d3.forceSimulation(characters)
        .force('link', d3.forceLink(relationships).id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(40));

    // 连线
    const link = g.append('g')
        .selectAll('line')
        .data(relationships)
        .enter().append('line')
        .attr('stroke', d => getLinkColor(d.type))
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6);

    // 节点
    const node = g.append('g')
        .selectAll('g')
        .data(characters)
        .enter().append('g')
        .call(d3.drag()
            .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
        .attr('r', d => getNodeRadius(d.type))
        .attr('fill', d => getNodeColor(d.type))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .on('click', (event, d) => showCharacterDetail(d));

    node.append('text')
        .text(d => d.name)
        .attr('y', d => getNodeRadius(d.type) + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('pointer-events', 'none');

    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    currentGraph = { center: () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity) };
}

// 侧边栏详情显示
function showCharacterDetail(character) {
    const detailPanel = document.getElementById('character-detail');
    if (!detailPanel) return;

    detailPanel.innerHTML = `
        <div class="character-detail">
            <div class="character-header">
                <h3>${character.name}</h3>
                <span class="character-badge" style="background:#5c0000; margin-right:5px;">${character.group || '未入册'}</span>
                <span class="character-badge">${getTypeLabel(character.type)}</span>
            </div>
            <div class="character-info">
                <div class="info-row"><strong>身份：</strong><span>${character.identity || '未指定'}</span></div>
                <div class="info-row"><strong>家族：</strong><span>${character.family || '未指定'}</span></div>
                <div class="info-row"><strong>籍册：</strong><span>${character.group || '其他'}</span></div>
            </div>
            <div class="character-description">
                <h4>人物描述</h4>
                <p>${character.description || '暂无详细描述'}</p>
            </div>
        </div>
    `;
}

// --- 索引分类与详情弹窗逻辑 ---
function initIndex() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
            loadIndexData(tabId);
        });
    });
    loadIndexData('persons');
}

async function loadIndexData(type) {
    const grid = document.querySelector(`#${type}-tab .index-grid`);
    if(!grid) return;
    const data = indexDataCache[type] || [];

    grid.innerHTML = data.map(item => {
        let title = item.name || item.title || item.phrase;
        let sub = item.identity || item.author || item.category || item.time || "";
        let groupTag = (type === 'persons' && item.group) ? `<small style="color:#8b0000;display:block;">[${item.group}]</small>` : "";
        return `
            <div class="index-item" onclick="showIndexItemDetail('${item.id}', '${type}')">
                <h4>${title}</h4>
                ${groupTag}
                <p>${sub}</p>
            </div>
        `;
    }).join('');
}

// 核心：点击索引后自动调取 JSON 详情
window.showIndexItemDetail = function(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if(!modal) return;

    const dataSource = indexDataCache[itemType] || [];
    const item = dataSource.find(d => d.id == itemId);
    if(!item) return;

    modalTitle.textContent = item.name || item.title || item.phrase || "项目详情";
    
    let html = '';
    switch(itemType) {
        case 'persons':
            html = `
                <div class="rich-detail">
                    <p><strong>籍册：</strong><span style="color:#8b0000;font-weight:bold;">${item.group || '未入册'}</span></p>
                    <p><strong>身份：</strong>${item.identity || '未知'}</p>
                    <p><strong>家族：</strong>${item.family || '未知'}</p>
                    <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
                    <p><strong>描述：</strong></p>
                    <p style="line-height:1.8; text-indent:2em;">${item.description || '暂无描述'}</p>
                </div>`;
            break;
        case 'items':
            html = `<p><strong>类别：</strong>${item.category}</p><p><strong>所有者：</strong>${item.owner}</p><hr><p>${item.description}</p>`;
            break;
        case 'poems':
            html = `<p><strong>作者：</strong>${item.author}</p><div style="background:#fdfcf8;padding:15px;border:1px solid #ddd;white-space:pre-wrap;text-align:center;">${item.content}</div>`;
            break;
        case 'proverbs':
            html = `<p><strong>出处：</strong>${item.source}</p><p><strong>寓意：</strong>${item.meaning}</p><blockquote style="border-left:4px solid #8b0000;padding-left:10px;">${item.content}</blockquote>`;
            break;
        default:
            html = `<p>${item.description || '暂无详细信息'}</p>`;
    }

    modalBody.innerHTML = html;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
};

// --- 其他辅助逻辑 (颜色、半径、搜索、时间轴等) ---
function getNodeColor(type) {
    const colors = { 'main': '#8b0000', 'major': '#d4af37', 'minor': '#2e8b57' };
    return colors[type] || '#6c757d';
}

function getNodeRadius(type) {
    const radii = { 'main': 25, 'major': 20, 'minor': 15 };
    return radii[type] || 10;
}

function getLinkColor(type) {
    const colors = { 'blood': '#dc3545', 'marriage': '#28a745', 'master-servant': '#fd7e14' };
    return colors[type] || '#999';
}

function getTypeLabel(type) {
    const labels = { 'main': '主要人物', 'major': '重要人物', 'minor': '次要人物' };
    return labels[type] || '其他';
}

function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;
    const timelineData = timeline.map(item => ({
        id: item.id, content: item.event,
        start: `${String(item.year).padStart(4, '0')}-01-01`,
        className: item.type
    }));
    new vis.Timeline(container, timelineData, { min: '0001-01-01', max: '0020-12-31' });
}

function initEvents() {
    const container = document.getElementById('events-container');
    if(!container) return;
    container.innerHTML = events.map(event => `
        <div class="event-card" onclick="showEventModalById('${event.id}')">
            <div class="event-category">${event.category}</div>
            <h3>${event.title}</h3>
            <p>第${event.year}年 · ${event.chapter}</p>
        </div>
    `).join('');
}

window.showEventModalById = function(id) {
    const event = events.find(e => e.id == id);
    if(event) {
        const modal = document.getElementById('detail-modal');
        document.getElementById('modal-title').textContent = event.title;
        document.getElementById('modal-body').innerHTML = `<p>${event.description}</p><p>涉及人物：${event.characters.join('、')}</p>`;
        modal.classList.add('active');
        modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
    }
}

function initSearch() {
    const input = document.getElementById('global-search');
    const btn = document.getElementById('search-btn');
    const search = () => {
        const q = input.value.trim().toLowerCase();
        if(!q) return;
        const res = characters.find(c => c.name.includes(q));
        if(res) { showSection('characters'); showCharacterDetail(res); }
    };
    btn.onclick = search;
    input.onkeypress = (e) => { if(e.key === 'Enter') search(); };
}
