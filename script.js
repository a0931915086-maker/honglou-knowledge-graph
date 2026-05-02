// 全局变量
let characters = [];
let relationships = [];
let events = [];
let timeline = [];
let currentGraph = null;
let currentSelectedNode = null;

// 详情数据缓存 (用于索引点击时调取)
let indexDataCache = {
    persons: [],
    items: [],
    festivals: [],
    poems: [],
    proverbs: []
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
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
        
        indexDataCache.persons = chars;
        indexDataCache.items = items;
        indexDataCache.festivals = festivals;
        indexDataCache.poems = poems;
        indexDataCache.proverbs = proverbs;
        
        updateStatistics();
        initNavigation();
        initHomePage();
        initCharacterGraph(); 
        
        try { initTimeline(); } catch(e) { console.error('时间轴初始化失败:', e); }
        try { initEvents(); } catch(e) { console.error('事件初始化失败:', e); }
        try { initIndex(); } catch(e) { console.error('索引初始化失败:', e); }
        try { initSearch(); } catch(e) { console.error('搜索初始化失败:', e); }
        
        showSection('home');
    }).catch(error => {
        console.error('加载核心数据失败:', error);
    });
});

// 数据加载
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        return [];
    }
}

function updateStatistics() {
    document.getElementById('character-count').textContent = Array.isArray(characters) ? characters.length : 0;
    document.getElementById('relationship-count').textContent = Array.isArray(relationships) ? relationships.length : 0;
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
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add('active');
    if (sectionId === 'characters' && currentGraph) {
        setTimeout(() => currentGraph.center(), 100);
    }
}

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

// --- 人物关系图谱核心 (复刻筛选与视觉) ---
function initCharacterGraph() {
    const graphContainer = document.getElementById('relationship-graph');
    if (!graphContainer || characters.length === 0) return;
    
    const width = graphContainer.clientWidth || 800;
    const height = 600;
    graphContainer.innerHTML = '';
    
    const svg = d3.select('#relationship-graph').append('svg')
        .attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);
    
    const g = svg.append('g');
    
    // 基础力学设置
    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(35));
    
    // 定义箭头
    svg.append('defs').selectAll('marker')
        .data(['arrow']).enter().append('marker')
        .attr('id', d => d).attr('viewBox', '0 -5 10 10')
        .attr('refX', 28).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#999');
    
    let linkGroup = g.append('g').attr('class', 'links');
    let nodeGroup = g.append('g').attr('class', 'nodes');

    // 核心筛选渲染函数
    function updateGraph() {
        const relFilter = document.getElementById('relation-filter')?.value || 'all';
        const familyFilter = document.getElementById('family-filter')?.value || 'all';

        // 1. 筛选节点
        const activeNodes = characters.filter(n => 
            familyFilter === 'all' || (n.family && n.family.includes(getFamilyName(familyFilter)))
        );
        const activeNodeIds = new Set(activeNodes.map(n => n.id));

        // 2. 筛选连线 (必须确保连线的两端节点都在当前显示的节点列表中)
        const activeLinks = relationships.filter(l => {
            const sId = l.source.id || l.source;
            const tId = l.target.id || l.target;
            const matchesType = relFilter === 'all' || l.type === relFilter;
            return matchesType && activeNodeIds.has(sId) && activeNodeIds.has(tId);
        });

        // 3. 更新连线
        const link = linkGroup.selectAll('line').data(activeLinks, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        link.exit().remove();
        const linkEnter = link.enter().append('line')
            .attr('class', 'link')
            .attr('stroke', d => getLinkColor(d.type))
            .attr('stroke-width', 2).attr('stroke-opacity', 0.6)
            .attr('marker-end', 'url(#arrow)');
        const combinedLinks = linkEnter.merge(link);

        // 4. 更新节点
        const node = nodeGroup.selectAll('g').data(activeNodes, d => d.id);
        node.exit().remove();
        const nodeEnter = node.enter().append('g').attr('class', 'node')
            .call(d3.drag()
                .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

        nodeEnter.append('circle').attr('r', d => getNodeRadius(d.type))
            .attr('fill', d => getNodeColor(d.type)).attr('stroke', '#fff').attr('stroke-width', 2);
        nodeEnter.append('text').text(d => d.name).attr('y', d => getNodeRadius(d.type) + 15)
            .attr('text-anchor', 'middle').style('font-size', '12px').style('pointer-events', 'none');

        const combinedNodes = nodeEnter.merge(node);

        // 交互事件
        combinedNodes.on('mouseover', function(e, d) {
            d3.select(this).select('circle').attr('stroke', '#ff6b6b').attr('stroke-width', 3);
            combinedLinks.attr('stroke-opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1);
        }).on('mouseout', function() {
            d3.select(this).select('circle').attr('stroke', '#fff').attr('stroke-width', 2);
            combinedLinks.attr('stroke-opacity', 0.6);
        }).on('click', (e, d) => {
            focusOnNode(d);
        });

        // 5. 更新力模拟
        simulation.nodes(activeNodes);
        simulation.force('link').links(activeLinks);
        simulation.alpha(1).restart();

        simulation.on('tick', () => {
            combinedLinks.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                         .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            combinedNodes.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }

    // 辅助聚焦函数
    function focusOnNode(d) {
        showCharacterDetail(d);
        const scale = 2;
        const x = width / 2 - d.x * scale;
        const y = height / 2 - d.y * scale;
        g.transition().duration(750).attr('transform', `translate(${x},${y}) scale(${scale})`);
    }

    // 监听筛选器
    document.getElementById('relation-filter')?.addEventListener('change', updateGraph);
    document.getElementById('family-filter')?.addEventListener('change', updateGraph);
    document.getElementById('reset-view')?.addEventListener('click', () => {
        document.getElementById('relation-filter').value = 'all';
        document.getElementById('family-filter').value = 'all';
        updateGraph();
        currentGraph.center();
    });

    updateGraph();

    svg.call(d3.zoom().extent([[0, 0], [width, height]]).scaleExtent([0.1, 4]).on('zoom', (event) => g.attr('transform', event.transform)));
    
    currentGraph = { 
        center: () => g.transition().duration(750).attr('transform', 'translate(0,0) scale(1)'),
        focus: (id) => {
            const d = characters.find(c => c.id == id);
            if(d) focusOnNode(d);
        }
    };
}

// 侧边栏详情
function showCharacterDetail(character) {
    const detailPanel = document.getElementById('character-detail');
    if (!detailPanel) return;
    const related = relationships.filter(r => (r.source.id || r.source) === character.id || (r.target.id || r.target) === character.id);
    const relHtml = related.map(rel => {
        const otherId = (rel.source.id || rel.source) === character.id ? (rel.target.id || rel.target) : (rel.source.id || rel.source);
        const otherChar = characters.find(c => c.id === otherId);
        return otherChar ? `<div class="relationship-item"><span class="relation-name">${otherChar.name}</span><span class="relation-type ${rel.type}">${rel.label}</span></div>` : '';
    }).join('');
    
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
            <div class="character-description"><h4>人物描述</h4><p>${character.description || '暂无描述'}</p></div>
            ${relHtml ? `<div class="character-relationships"><h4>人物关系</h4><div class="relationships-list">${relHtml}</div></div>` : ''}
        </div>`;
}

// --- 时间轴逻辑 ---
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;
    const timelineData = timeline.map(item => ({
        id: item.id, content: item.event,
        start: `${String(item.year).padStart(4, '0')}-01-01`,
        end: `${String(item.year).padStart(4, '0')}-12-31`,
        type: 'range', className: item.type || 'default'
    }));
    const options = {
        width: '100%', height: '100%', min: '0001-01-01', max: '0020-12-31', 
        start: '0001-01-01', end: '0015-12-31', zoomMin: 1000 * 60 * 60 * 24 * 365,
        moveable: true, zoomable: true, orientation: { axis: 'both', item: 'top' },
        format: { minorLabels: { year: 'YYYY年' } }
    };
    const timelineInstance = new vis.Timeline(container, timelineData, options);
    document.getElementById('zoom-in')?.addEventListener('click', () => timelineInstance.zoomIn(0.5));
    document.getElementById('zoom-out')?.addEventListener('click', () => timelineInstance.zoomOut(0.5));
    document.getElementById('fit-timeline')?.addEventListener('click', () => timelineInstance.fit());
    timelineInstance.on('click', (props) => {
        if (props.item) {
            const item = timeline.find(d => d.id == props.item);
            if (item) showEventModal({title: item.event, chapter: item.chapter, year: item.year, description: item.description});
        }
    });
}

// --- 重要事件逻辑 (含联动搜索) ---
function initEvents() {
    const container = document.getElementById('events-container');
    const searchInput = document.getElementById('event-search');
    const categorySelect = document.getElementById('event-category');
    if(!container) return;

    function renderEvents(filtered = events) {
        container.innerHTML = filtered.map(e => `
            <div class="event-card" data-id="${e.id}">
                <div class="event-category">${getEventCategoryLabel(e.category)}</div>
                <h3>${e.title}</h3>
                <div class="event-time"><i class="fas fa-clock"></i><span>第${e.year}年 · ${e.season || ''} · ${e.chapter}</span></div>
                <p>${e.description ? e.description.substring(0, 100) : ''}...</p>
            </div>`).join('');
        container.querySelectorAll('.event-card').forEach(card => card.addEventListener('click', () => {
            const e = events.find(item => item.id == card.getAttribute('data-id'));
            if(e) showEventModal(e);
        }));
    }

    const triggerFilter = () => {
        const query = (searchInput?.value || '').toLowerCase();
        const cat = categorySelect?.value || 'all';
        const filtered = events.filter(e => 
            (e.title.toLowerCase().includes(query) || (e.description || '').toLowerCase().includes(query)) &&
            (cat === 'all' || e.category === cat)
        );
        renderEvents(filtered);
    };

    searchInput?.addEventListener('input', triggerFilter);
    categorySelect?.addEventListener('change', triggerFilter);
    renderEvents();
}

// --- 全局搜索逻辑 (含跳转) ---
function initSearch() {
    const input = document.getElementById('global-search');
    const btn = document.getElementById('search-btn');
    if(!input || !btn) return;
    
    function perform() {
        const q = input.value.trim().toLowerCase();
        if (!q) return;
        const all = [
            ...characters.map(c => ({...c, sType: 'character'})),
            ...events.map(e => ({...e, sType: 'event'})),
            ...timeline.map(t => ({...t, sType: 'timeline'})),
            ...indexDataCache.items.map(i => ({...i, sType: 'item'})),
            ...indexDataCache.poems.map(p => ({...p, sType: 'poem'}))
        ];
        const res = all.filter(item => (item.name || item.title || item.phrase || item.event || '').toLowerCase().includes(q));
        
        const modal = document.getElementById('detail-modal');
        document.getElementById('modal-title').textContent = `搜索: "${q}" (${res.length})`;
        document.getElementById('modal-body').innerHTML = `<div class="search-results">${res.slice(0,15).map(i => `
            <div class="search-result-item" data-id="${i.id}" data-type="${i.sType}" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee;">
                <h4>${i.name || i.title || i.phrase || i.event}</h4><p><small>类别: ${getTypeLabel(i.sType)}</small></p>
            </div>`).join('')}</div>`;
        
        modal.querySelectorAll('.search-result-item').forEach(el => el.addEventListener('click', () => {
            const id = el.getAttribute('data-id'), type = el.getAttribute('data-type');
            modal.classList.remove('active');
            
            // 执行跳转定位
            if (type === 'character') {
                showSection('characters');
                setTimeout(() => currentGraph.focus(id), 300);
            } else if (type === 'event') {
                showSection('events');
                const e = events.find(ev => ev.id == id);
                if(e) showEventModal(e);
            } else {
                const item = (indexDataCache[type+'s'] || indexDataCache.items || []).find(d => d.id == id);
                if(item) showIndexItemDetail(id, type === 'poem' ? 'poems' : 'items');
            }
        }));
        modal.classList.add('active');
    }
    btn.addEventListener('click', perform);
    input.addEventListener('keypress', (e) => e.key === 'Enter' && perform());
}

// --- 索引模块 ---
function initIndex() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(`${tid}-tab`).classList.add('active');
        loadIndexData(tid);
    }));
    loadIndexData('persons');
}

function loadIndexData(type) {
    const grid = document.querySelector(`#${type}-tab .index-grid`);
    if(!grid) return;
    const data = indexDataCache[type] || [];
    grid.innerHTML = data.map(item => {
        let title = item.name || item.title || item.phrase;
        let gTag = (type === 'persons' && item.group) ? `<small style="color:#8b0000;display:block;">[${item.group}]</small>` : "";
        let labels = (type === 'persons') ? `<p><strong>身份:</strong> ${item.identity}</p><p><strong>家族:</strong> ${item.family}</p>` :
                     (type === 'items') ? `<p><strong>类别:</strong> ${item.category}</p><p><strong>所有者:</strong> ${item.owner}</p>` :
                     (type === 'festivals') ? `<p><strong>时间:</strong> ${item.time}</p><p><strong>章节:</strong> ${item.chapter}</p>` :
                     (type === 'poems') ? `<p><strong>作者:</strong> ${item.author}</p><p><strong>章节:</strong> ${item.chapter}</p>` :
                     `<p><strong>出处:</strong> ${item.source || ''}</p>`;
        return `<div class="index-item" onclick="showIndexItemDetail('${item.id}', '${type}')"><h4>${title}</h4>${gTag}${labels}</div>`;
    }).join('');
}

window.showIndexItemDetail = function(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const list = indexDataCache[itemType] || [];
    const item = list.find(d => d.id == itemId);
    if(!item) return;
    document.getElementById('modal-title').textContent = item.name || item.title || item.phrase || item.event;
    let html = (itemType === 'persons') ? `<p><strong>籍册：</strong>${item.group || '未入册'}</p><p><strong>身份：</strong>${item.identity}</p><hr><p>${item.description}</p>` :
               (itemType === 'poems') ? `<div style="white-space:pre-wrap;text-align:center;font-family:serif;line-height:2;">${item.content}</div>` : 
               `<p>${item.description || item.meaning || item.content || ''}</p>`;
    document.getElementById('modal-body').innerHTML = html;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
};

// 辅助函数
function showEventModal(ev) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').textContent = ev.title || ev.event || "详情";
    document.getElementById('modal-body').innerHTML = `<p><strong>时间：</strong>第${ev.year}年 · ${ev.chapter || ''}</p><p>${ev.description || ''}</p>`;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
}

function getFamilyName(k) { return {jia:'贾',wang:'王',shi:'史',xue:'薛'}[k] || ''; }
function getEventCategoryLabel(c) { return {family:'家族兴衰',love:'情感主线',fate:'命运转折',social:'社会事件'}[c] || '其他'; }
function getTypeLabel(t) { return {main:'主要人物',major:'重要人物',minor:'次要人物',character:'人物',event:'事件',poem:'诗词',item:'器物'}[t] || t; }
function getNodeColor(t) { return {main:'#8b0000',major:'#d4af37',minor:'#2e8b57'}[t] || '#6c757d'; }
function getNodeRadius(t) { return {main:25,major:20,minor:15}[t] || 10; }
function getLinkColor(t) { return {blood:'#dc3545',marriage:'#28a745',master_servant:'#fd7e14',emotional:'#17a2b8',family:'#6f42c1'}[t] || '#999'; }
