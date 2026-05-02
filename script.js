// 全局变量
let characters = [];
let relationships = [];
let events = [];
let timeline = [];
let currentGraph = null;
let currentSelectedNode = null;
let simulation = null; // 提升模拟器为全局，方便更新

// 详情数据缓存
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
        console.error('加载数据失败:', error);
    });
});

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

// --- 【核心修改】人物关系图谱逻辑 ---
function initCharacterGraph() {
    const graphContainer = document.getElementById('relationship-graph');
    if (!graphContainer || characters.length === 0) return;
    
    const width = graphContainer.clientWidth || 800;
    const height = 600;
    graphContainer.innerHTML = '';
    
    const svg = d3.select('#relationship-graph').append('svg')
        .attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);
    
    const g = svg.append('g');
    
    // 初始化模拟器
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(40));

    // 定义箭头
    svg.append('defs').selectAll('marker')
        .data(['arrow']).enter().append('marker')
        .attr('id', d => d).attr('viewBox', '0 -5 10 10')
        .attr('refX', 28).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#999');

    // 缩放控制
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // 绘制函数
    function updateGraph(nodesData, linksData) {
        // 1. 连线更新
        const link = g.selectAll('.link')
            .data(linksData, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        
        link.exit().remove();
        
        const linkEnter = link.enter().append('line')
            .attr('class', 'link')
            .attr('stroke', d => getLinkColor(d.type))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6)
            .attr('marker-end', 'url(#arrow)');
            
        const mergedLink = linkEnter.merge(link);

        // 2. 节点更新
        const node = g.selectAll('.node')
            .data(nodesData, d => d.id);
            
        node.exit().remove();
        
        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

        nodeEnter.append('circle')
            .attr('r', d => getNodeRadius(d.type))
            .attr('fill', d => getNodeColor(d.type))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        nodeEnter.append('text')
            .text(d => d.name)
            .attr('y', d => getNodeRadius(d.type) + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .style('pointer-events', 'none');

        const mergedNode = nodeEnter.merge(node);

        // 交互
        mergedNode.on('mouseover', function(e, d) {
            d3.select(this).select('circle').attr('stroke', '#ff6b6b').attr('stroke-width', 3);
            mergedLink.attr('stroke-opacity', l => 
                ((l.source.id || l.source) === d.id || (l.target.id || l.target) === d.id) ? 1 : 0.1
            );
        }).on('mouseout', function() {
            d3.select(this).select('circle').attr('stroke', '#fff').attr('stroke-width', 2);
            mergedLink.attr('stroke-opacity', 0.6);
        }).on('click', (e, d) => showCharacterDetail(d));

        // 3. 重启模拟器
        simulation.nodes(nodesData);
        simulation.force('link').links(linksData);
        simulation.alpha(1).restart();

        simulation.on('tick', () => {
            mergedLink.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            mergedNode.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }

    // 初始渲染
    updateGraph(characters, relationships);

    // --- 筛选逻辑 ---
    const relationFilter = document.getElementById('relation-filter');
    const familyFilter = document.getElementById('family-filter');
    const resetBtn = document.getElementById('reset-view');

    const applyFilters = () => {
        const relType = relationFilter.value;
        const familyType = familyFilter.value;

        // 过滤连线
        let filteredRels = relationships.filter(r => {
            const matchRel = (relType === 'all' || r.type === relType);
            return matchRel;
        });

        // 过滤节点
        let filteredNodes = characters.filter(c => {
            const matchFamily = (familyType === 'all' || c.family === familyType);
            return matchFamily;
        });

        // 核心修正：确保所有显示的连线，其两端的节点都必须存在
        const activeNodeIds = new Set(filteredNodes.map(n => n.id));
        if (relType !== 'all') {
             // 如果选了特定关系，需要强制显示涉及这些关系的人，即使不属于选中的家族
             filteredRels.forEach(r => {
                activeNodeIds.add(r.source.id || r.source);
                activeNodeIds.add(r.target.id || r.target);
             });
        } else if (familyType !== 'all') {
            // 如果选了家族，只保留两端都在该家族内（或关联）的线
            filteredRels = filteredRels.filter(r => 
                activeNodeIds.has(r.source.id || r.source) && activeNodeIds.has(r.target.id || r.target)
            );
        }

        const finalNodes = characters.filter(c => activeNodeIds.has(c.id));
        updateGraph(finalNodes, filteredRels);
    };

    if(relationFilter) relationFilter.addEventListener('change', applyFilters);
    if(familyFilter) familyFilter.addEventListener('change', applyFilters);
    if(resetBtn) resetBtn.addEventListener('click', () => {
        relationFilter.value = 'all';
        familyFilter.value = 'all';
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        updateGraph(characters, relationships);
    });

    currentGraph = { 
        center: () => svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity),
        focus: (id) => {
            const d = characters.find(c => c.id == id);
            if(d) {
                showCharacterDetail(d);
                const scale = 1.5;
                const x = width / 2 - d.x * scale;
                const y = height / 2 - d.y * scale;
                svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
            }
        }
    };
}

// 侧边栏详情
function showCharacterDetail(character) {
    const detailPanel = document.getElementById('character-detail');
    if (!detailPanel) return;
    
    // 兼容 d3 转换后的对象或原始 ID
    const related = relationships.filter(r => {
        const sId = r.source.id || r.source;
        const tId = r.target.id || r.target;
        return sId === character.id || tId === character.id;
    });

    const relatedHtml = related.map(rel => {
        const sId = rel.source.id || rel.source;
        const tId = rel.target.id || rel.target;
        const otherId = sId === character.id ? tId : sId;
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
            </div>
            <div class="character-description">
                <h4>人物描述</h4>
                <p>${character.description || '暂无详细描述'}</p>
            </div>
            ${relatedHtml ? `<div class="character-relationships"><h4>人物关系</h4><div class="relationships-list">${relatedHtml}</div></div>` : ''}
        </div>
    `;
}

// --- 时间轴逻辑 ---
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;
    const timelineData = timeline.map(item => ({
        id: item.id, content: item.event,
        start: `${String(item.year).padStart(4, '0')}-01-01`,
        type: 'range', className: item.type || 'default'
    }));
    const options = {
        width: '100%', height: '100%', min: '0001-01-01', max: '0020-12-31', 
        zoomMin: 1000 * 60 * 60 * 24 * 365,
        format: { minorLabels: { year: 'YYYY年' } }
    };
    const timelineInstance = new vis.Timeline(container, timelineData, options);
    timelineInstance.on('click', (props) => {
        if (props.item) {
            const item = timeline.find(d => d.id == props.item);
            if (item) showEventModal({title: item.event, chapter: item.chapter, year: item.year, description: item.description});
        }
    });
}

// --- 重要事件逻辑 ---
function initEvents() {
    const container = document.getElementById('events-container');
    const searchInput = document.getElementById('event-search');
    const categorySelect = document.getElementById('event-category');
    if(!container) return;

    function renderEvents(filteredEvents = events) {
        container.innerHTML = filteredEvents.map(e => `
            <div class="event-card" data-id="${e.id}">
                <div class="event-category">${getEventCategoryLabel(e.category)}</div>
                <h3>${e.title}</h3>
                <div class="event-time"><i class="fas fa-clock"></i><span>第${e.year}年 · ${e.chapter}</span></div>
            </div>
        `).join('');
        container.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const e = events.find(item => item.id == card.getAttribute('data-id'));
                if(e) showEventModal(e);
            });
        });
    }

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        renderEvents(events.filter(e => e.title.toLowerCase().includes(query)));
    });
    renderEvents();
}

// --- 全局搜索逻辑 ---
function initSearch() {
    const searchInput = document.getElementById('global-search');
    const searchBtn = document.getElementById('search-btn');
    if(!searchInput || !searchBtn) return;
    
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;
        const allData = [
            ...characters.map(c => ({...c, searchType: 'character'})),
            ...events.map(e => ({...e, searchType: 'event'}))
        ];
        const results = allData.filter(item => (item.name || item.title || '').toLowerCase().includes(query));
        showSearchResults(results, query);
    }
    searchBtn.addEventListener('click', performSearch);
}

function showSearchResults(results, query) {
    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    document.getElementById('modal-title').textContent = `搜索: "${query}"`;
    modalBody.innerHTML = results.map(item => `<div class="search-result-item" onclick="executeJump('${item.id}', '${item.searchType}')">${item.name || item.title} <small>(${getTypeLabel(item.searchType)})</small></div>`).join('');
    modal.classList.add('active');
}

window.executeJump = function(id, type) {
    document.getElementById('detail-modal').classList.remove('active');
    if (type === 'character') {
        const navLink = document.querySelector('.nav-link[href="#characters"]');
        if(navLink) navLink.click();
        setTimeout(() => currentGraph.focus(id), 500);
    }
}

// --- 索引模块 ---
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
    loadIndexData('persons');
}

function loadIndexData(type) {
    const grid = document.querySelector(`#${type}-tab .index-grid`);
    if(!grid) return;
    const data = indexDataCache[type] || [];
    grid.innerHTML = data.map(item => `
        <div class="index-item" onclick="showIndexItemDetail('${item.id}', '${type}')">
            <h4>${item.name || item.title || item.phrase}</h4>
            <p>${item.identity || item.category || ""}</p>
        </div>
    `).join('');
}

window.showIndexItemDetail = function(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const item = indexDataCache[itemType].find(d => d.id == itemId);
    if(!item) return;
    document.getElementById('modal-title').textContent = item.name || item.title || item.phrase;
    document.getElementById('modal-body').innerHTML = `<p>${item.description || item.content || '暂无内容'}</p>`;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
};

function showEventModal(ev) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').textContent = ev.title || ev.event;
    document.getElementById('modal-body').innerHTML = `<p><strong>时间：</strong>第${ev.year}年</p><p>${ev.description || ''}</p>`;
    modal.classList.add('active');
}

function getEventCategoryLabel(c) { return {'family':'家族兴衰','love':'情感主线','fate':'命运转折'}[c] || '其他'; }
function getTypeLabel(t) { return {character:'人物',event:'事件',main:'主要人物',major:'重要人物'}[t] || t; }
function getNodeColor(t) { return {main:'#8b0000',major:'#d4af37',minor:'#2e8b57'}[t] || '#6c757d'; }
function getNodeRadius(t) { return {main:25,major:20,minor:15}[t] || 12; }
function getLinkColor(t) { return {blood:'#dc3545',marriage:'#28a745','master-servant':'#fd7e14',emotional:'#17a2b8'}[t] || '#999'; }
