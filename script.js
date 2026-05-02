// 全局变量
let characters = [];
let relationships = [];
let events = [];
let timeline = [];
let currentGraph = null;
let currentSelectedNode = null;

// 数据缓存，用于存储详情数据
let indexDataCache = {
    persons: [],
    items: [],
    festivals: [],
    poems: [],
    proverbs: []
};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载数据
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

// 数据加载函数
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        return [];
    }
}

// 更新统计
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

// --- 完全复刻：人物关系图谱逻辑 ---
function initCharacterGraph() {
    const graphContainer = document.getElementById('relationship-graph');
    if (!graphContainer || characters.length === 0) return;
    
    const width = graphContainer.clientWidth || 800;
    const height = graphContainer.clientHeight || 600;
    graphContainer.innerHTML = '';
    
    const svg = d3.select('#relationship-graph').append('svg')
        .attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);
    
    const g = svg.append('g');
    
    const simulation = d3.forceSimulation(characters)
        .force('link', d3.forceLink(relationships).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    
    svg.append('defs').selectAll('marker')
        .data(['arrow']).enter().append('marker')
        .attr('id', d => d).attr('viewBox', '0 -5 10 10')
        .attr('refX', 25).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#999');
    
    const link = g.append('g').attr('class', 'links')
        .selectAll('line').data(relationships).enter().append('line')
        .attr('class', 'link')
        .attr('stroke', d => getLinkColor(d.type))
        .attr('stroke-width', 2).attr('stroke-opacity', 0.6).attr('marker-end', 'url(#arrow)');
    
    const node = g.append('g').attr('class', 'nodes')
        .selectAll('g').data(characters).enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
            .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));
    
    node.append('circle').attr('r', d => getNodeRadius(d.type))
        .attr('fill', d => getNodeColor(d.type)).attr('stroke', '#fff').attr('stroke-width', 2).style('cursor', 'pointer');
    
    node.append('text').text(d => d.name).attr('x', 0).attr('y', d => getNodeRadius(d.type) + 15)
        .attr('text-anchor', 'middle').attr('font-size', '12px').attr('fill', '#333').style('pointer-events', 'none');
    
    node.on('mouseover', function(e, d) {
        d3.select(this).select('circle').attr('stroke', '#ff6b6b').attr('stroke-width', 3);
        link.attr('stroke-opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2);
    }).on('mouseout', function() {
        d3.select(this).select('circle').attr('stroke', '#fff').attr('stroke-width', 2);
        link.attr('stroke-opacity', 0.6);
    }).on('click', (e, d) => {
        showCharacterDetail(d);
        const scale = 2;
        g.transition().duration(750).attr('transform', `translate(${width/2 - d.x*scale},${height/2 - d.y*scale}) scale(${scale})`);
    });
    
    svg.call(d3.zoom().extent([[0, 0], [width, height]]).scaleExtent([0.1, 4]).on('zoom', (event) => g.attr('transform', event.transform)));
    
    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    currentGraph = { center: () => g.transition().duration(750).attr('transform', 'translate(0,0) scale(1)') };
}

// 侧边栏详情显示 (包含 Group 标签)
function showCharacterDetail(character) {
    const detailPanel = document.getElementById('character-detail');
    if (!detailPanel) return;
    
    const related = relationships.filter(r => (r.source.id || r.source) === character.id || (r.target.id || r.target) === character.id);
    const relatedHtml = related.map(rel => {
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
            <div class="character-description">
                <h4>人物描述</h4>
                <p>${character.description || '暂无详细描述'}</p>
            </div>
            ${relatedHtml ? `<div class="character-relationships"><h4>人物关系</h4><div class="relationships-list">${relatedHtml}</div></div>` : ''}
        </div>
    `;
}

// --- 完全复刻：时间轴逻辑 ---
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;
    try {
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
    } catch (err) { console.error(err); }
}

// --- 完全复刻：重要事件 ---
function initEvents() {
    const container = document.getElementById('events-container');
    if(!container) return;
    function render(data = events) {
        container.innerHTML = data.map(e => `
            <div class="event-card" data-id="${e.id}">
                <div class="event-category">${getEventCategoryLabel(e.category)}</div>
                <h3>${e.title}</h3>
                <div class="event-time"><i class="fas fa-clock"></i><span>第${e.year}年 · ${e.season} · ${e.chapter}</span></div>
                <p>${e.description ? e.description.substring(0, 100) : ''}...</p>
            </div>
        `).join('');
        container.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const e = events.find(item => item.id == card.getAttribute('data-id'));
                if(e) showEventModal(e);
            });
        });
    }
    render();
}

// --- 完全复刻并修正：索引列表 ---
function initIndex() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tid = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(`${tid}-tab`).classList.add('active');
            loadIndexData(tid);
        });
    });
    loadIndexData('persons');
}

// 修正：完全按照原模版标签显示（不使用 信息1、信息2）
function loadIndexData(type) {
    const grid = document.querySelector(`#${type}-tab .index-grid`);
    if(!grid) return;
    const data = indexDataCache[type] || [];
    
    grid.innerHTML = data.map(item => {
        let title = item.name || item.title || item.phrase;
        let groupTag = (type === 'persons' && item.group) ? `<small style="color:#8b0000; display:block;">[${item.group}]</small>` : "";
        let labels = "";

        // 根据类型复刻最原始的标签
        if (type === 'persons') {
            labels = `<p><strong>身份:</strong> ${item.identity || '未指定'}</p><p><strong>家族:</strong> ${item.family || '未指定'}</p>`;
        } else if (type === 'items') {
            labels = `<p><strong>类别:</strong> ${item.category || '未分类'}</p><p><strong>所有者:</strong> ${item.owner || '未指定'}</p>`;
        } else if (type === 'festivals') {
            labels = `<p><strong>时间:</strong> ${item.time || '未指定'}</p><p><strong>章节:</strong> ${item.chapter || '未指定'}</p>`;
        } else if (type === 'poems') {
            labels = `<p><strong>作者:</strong> ${item.author || '未指定'}</p><p><strong>章节:</strong> ${item.chapter || '未指定'}</p>`;
        } else if (type === 'proverbs') {
            labels = `<p><strong>出处:</strong> ${item.source || '未指定'}</p>`;
        }

        return `
            <div class="index-item" data-id="${item.id}" data-type="${type}">
                <h4>${title}</h4>
                ${groupTag}
                ${labels}
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.index-item').forEach(item => {
        item.addEventListener('click', () => showIndexItemDetail(item.getAttribute('data-id'), item.getAttribute('data-type')));
    });
}

// 详情弹窗逻辑
window.showIndexItemDetail = function(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const list = indexDataCache[itemType] || [];
    const item = list.find(d => d.id == itemId);
    if(!item) return;

    modalTitle.textContent = item.name || item.title || item.phrase || "详情";
    let html = "";
    if (itemType === 'persons') {
        html = `
            <div class="rich-detail">
                <p><strong>籍册：</strong><span style="color:#8b0000; font-weight:bold;">${item.group || '未入册'}</span></p>
                <p><strong>身份：</strong>${item.identity || '未知'}</p>
                <p><strong>家族：</strong>${item.family || '未知'}</p>
                <hr><p><strong>描述：</strong></p><p style="line-height:1.8; text-indent:2em;">${item.description || '暂无描述'}</p>
            </div>`;
    } else if (itemType === 'poems') {
        html = `<p><strong>作者：</strong>${item.author} | <strong>章节：</strong>${item.chapter}</p><div style="background:#fdfcf8; padding:20px; border:1px solid #ddd; white-space:pre-wrap; text-align:center; font-family:serif; line-height:2;">${item.content}</div>`;
    } else if (itemType === 'proverbs') {
        html = `<p><strong>出处：</strong>${item.source}</p><p><strong>释义：</strong>${item.meaning}</p><blockquote style="border-left:4px solid #8b0000; padding:10px; font-style:italic;">"${item.content}"</blockquote>`;
    } else if (itemType === 'items') {
        html = `<p><strong>类别：</strong>${item.category}</p><p><strong>所有者：</strong>${item.owner}</p><hr><p>${item.description}</p><p style="color:#8b0000; margin-top:10px;"><strong>象征：</strong>${item.significance || ''}</p>`;
    } else {
        html = `<p>${item.description || item.meaning || '暂无详细内容'}</p>`;
    }
    modalBody.innerHTML = html;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
}

// 辅助函数
function showEventModal(ev) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').textContent = ev.title || "详情";
    document.getElementById('modal-body').innerHTML = `<p><strong>时间：</strong>第${ev.year}年 · ${ev.chapter || ''}</p><p style="margin-top:10px;">${ev.description || ''}</p>`;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
}

function initSearch() {
    const input = document.getElementById('global-search');
    document.getElementById('search-btn')?.addEventListener('click', () => {
        const q = input.value.trim().toLowerCase();
        if(!q) return;
        const res = characters.find(c => c.name.includes(q));
        if(res) { showSection('characters'); setTimeout(() => showCharacterDetail(res), 200); }
    });
}

function getEventCategoryLabel(c) { return {'family':'家族兴衰','love':'情感主线','fate':'命运转折'}[c] || '其他'; }
function getTypeLabel(t) { return {'main':'主要人物','major':'重要人物','minor':'次要人物'}[t] || '其他'; }
function getNodeColor(t) { return {'main':'#8b0000','major':'#d4af37','minor':'#2e8b57'}[t] || '#6c757d'; }
function getNodeRadius(t) { return {'main':25,'major':20,'minor':15}[t] || 10; }
function getLinkColor(t) { return {'blood':'#dc3545','marriage':'#28a745','master-servant':'#fd7e14','emotional':'#17a2b8','family':'#6f42c1'}[t] || '#999'; }
