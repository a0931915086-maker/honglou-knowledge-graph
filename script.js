// 全局变量
let characters =[];
let relationships = [];
let events = [];
let timeline =[];
let currentGraph = null;
let currentSelectedNode = null;

// 增加：用于分类索引的缓存数据
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
        
        // 缓存所有数据供索引详情调取
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
        initCharacterGraph();
        
        try { initTimeline(); } catch(e) { console.error('时间轴初始化跳过:', e); }
        try { initEvents(); } catch(e) { console.error('事件初始化跳过:', e); }
        try { initIndex(); } catch(e) { console.error('索引初始化跳过:', e); }
        try { initSearch(); } catch(e) { console.error('搜索初始化跳过:', e); }
        
        // 显示首页
        showSection('home');
    }).catch(error => {
        console.error('加载核心数据失败:', error);
        alert('加载数据失败，请按F12查看控制台报错详情');
    });
});

// 数据加载
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return[]; 
        return await response.json();
    } catch (error) {
        return[]; 
    }
}

// 更新统计数据
function updateStatistics() {
    document.getElementById('character-count').textContent = Array.isArray(characters) ? characters.length : 0;
    document.getElementById('relationship-count').textContent = Array.isArray(relationships) ? relationships.length : 0;
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
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    if (sectionId === 'characters' && currentGraph) {
        setTimeout(() => {
            currentGraph.center();
        }, 100);
    }
}

// 首页初始化
function initHomePage() {
    const quickLinks = document.querySelectorAll('.link-card');
    quickLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const targetLink = document.querySelector(`.nav-link[href="#${target}"]`);
            if(targetLink) targetLink.classList.add('active');
            showSection(target);
        });
    });
}

// 原原本本复刻：人物关系图初始化
function initCharacterGraph() {
    const graphContainer = document.getElementById('relationship-graph');
    if (!graphContainer || characters.length === 0) return;
    
    const width = graphContainer.clientWidth || 800;
    const height = graphContainer.clientHeight || 600;
    graphContainer.innerHTML = '';
    
    const svg = d3.select('#relationship-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height]);
    
    const g = svg.append('g');
    
    const simulation = d3.forceSimulation(characters)
        .force('link', d3.forceLink(relationships).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    
    // 复刻：箭头标记
    svg.append('defs').selectAll('marker')
        .data(['arrow'])
        .enter().append('marker')
        .attr('id', d => d)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#999');
    
    // 复刻：连线样式
    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(relationships)
        .enter().append('line')
        .attr('class', 'link')
        .attr('stroke', d => getLinkColor(d.type))
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6)
        .attr('marker-end', 'url(#arrow)');
    
    // 复刻：节点样式
    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(characters)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    node.append('circle')
        .attr('r', d => getNodeRadius(d.type))
        .attr('fill', d => getNodeColor(d.type))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer');
    
    node.append('text')
        .text(d => d.name)
        .attr('x', 0)
        .attr('y', d => getNodeRadius(d.type) + 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#333')
        .style('pointer-events', 'none');
    
    // 复刻：悬停效果
    node.on('mouseover', function(event, d) {
        d3.select(this).select('circle').attr('stroke', '#ff6b6b').attr('stroke-width', 3);
        link.attr('stroke-opacity', l => 
            (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
        );
    })
    .on('mouseout', function(event, d) {
        d3.select(this).select('circle').attr('stroke', '#fff').attr('stroke-width', 2);
        link.attr('stroke-opacity', 0.6);
    })
    .on('click', function(event, d) {
        showCharacterDetail(d);
        const scale = 2;
        const x = width / 2 - d.x * scale;
        const y = height / 2 - d.y * scale;
        g.transition().duration(750).attr('transform', `translate(${x},${y}) scale(${scale})`);
    });
    
    svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        }));
    
    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    currentGraph = {
        center: function() {
            g.transition().duration(750).attr('transform', 'translate(0,0) scale(1)');
        }
    };
    
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }
}

// 复刻：显示人物详情 (增加 group 显示)
function showCharacterDetail(character) {
    const detailPanel = document.getElementById('character-detail');
    if (!detailPanel) return;
    
    // 注意：仿真启动后 source/target 变为了对象，需对比 ID
    const relatedRelationships = relationships.filter(r => 
        (r.source.id || r.source) === character.id || (r.target.id || r.target) === character.id
    );
    
    const relatedCharacters = relatedRelationships.map(rel => {
        const otherId = (rel.source.id || rel.source) === character.id ? (rel.target.id || rel.target) : (rel.source.id || rel.source);
        const otherChar = characters.find(c => c.id === otherId);
        return otherChar ? { name: otherChar.name, relation: rel.label, type: rel.type } : null;
    }).filter(Boolean);
    
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
            ${relatedCharacters.length > 0 ? `
            <div class="character-relationships">
                <h4>人物关系</h4>
                <div class="relationships-list">
                    ${relatedCharacters.map(rel => `
                        <div class="relationship-item">
                            <span class="relation-name">${rel.name}</span>
                            <span class="relation-type ${rel.type}">${rel.relation}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    currentSelectedNode = character;
}

// 原原本本复刻：时间轴
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;
    
    try {
        const timelineData = timeline.map(item => {
            const yearNum = parseInt(item.year) || 1;
            const yearStr = String(yearNum).padStart(4, '0');
            return {
                id: item.id,
                content: item.event,
                start: `${yearStr}-01-01`,
                end: `${yearStr}-12-31`,
                type: 'range',
                className: item.type || 'default',
                title: item.chapter || '',
                description: item.description || ''
            };
        });
        
        const options = {
            width: '100%', height: '100%',
            min: '0001-01-01', max: '0020-12-31', 
            start: '0001-01-01', end: '0015-12-31',
            zoomMin: 1000 * 60 * 60 * 24 * 365, 
            moveable: true, zoomable: true,
            orientation: { axis: 'both', item: 'top' },
            format: { minorLabels: { year: 'YYYY年' } }
        };
        
        if (typeof vis !== 'undefined') {
            const timelineInstance = new vis.Timeline(container, timelineData, options);
            
            // 复刻按钮逻辑
            document.getElementById('zoom-in')?.addEventListener('click', () => timelineInstance.zoomIn(0.5));
            document.getElementById('zoom-out')?.addEventListener('click', () => timelineInstance.zoomOut(0.5));
            document.getElementById('fit-timeline')?.addEventListener('click', () => timelineInstance.fit());
            
            timelineInstance.on('click', function(properties) {
                if (properties.item) {
                    const item = timeline.find(d => d.id == properties.item);
                    if (item) showEventModal({title: item.event, chapter: item.chapter, year: item.year, description: item.description});
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<p style="color:red;text-align:center;">时间轴加载失败</p>`;
    }
}

// 原原本本复刻：事件页面
function initEvents() {
    const container = document.getElementById('events-container');
    if(!container) return;
    
    function renderEvents(filteredEvents = events) {
        container.innerHTML = filteredEvents.map(event => `
            <div class="event-card" data-id="${event.id}">
                <div class="event-category">${getEventCategoryLabel(event.category)}</div>
                <h3>${event.title}</h3>
                <div class="event-time"><i class="fas fa-clock"></i><span>第${event.year}年 · ${event.season} · ${event.chapter}</span></div>
                <p>${event.description ? event.description.substring(0, 100) : ''}...</p>
                <div class="event-characters">${event.characters ? `<small>涉及人物: ${event.characters.slice(0, 3).join('、')}</small>` : ''}</div>
            </div>
        `).join('');
        
        container.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const event = events.find(e => e.id == card.getAttribute('data-id'));
                if (event) showEventModal(event);
            });
        });
    }
    
    renderEvents();
    
    document.getElementById('event-search')?.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        const category = document.getElementById('event-category').value;
        const filtered = events.filter(e => 
            (e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query)) &&
            (category === 'all' || e.category === category)
        );
        renderEvents(filtered);
    });
}

// 复刻：索引初始化
function initIndex() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
            loadIndexData(tabId);
        });
    });
    loadIndexData('persons');
}

// 复刻：加载索引数据 (修正详情调用)
function loadIndexData(type) {
    const grid = document.querySelector(`#${type}-tab .index-grid`);
    if(!grid) return;
    const data = indexDataCache[type] || [];

    grid.innerHTML = data.map(item => {
        let title = item.name || item.title || item.phrase;
        let info1 = item.identity || item.author || item.category || item.time || "";
        let info2 = item.family || item.chapter || item.owner || item.source || "";
        // 增加 group 预览
        let groupTag = (type === 'persons' && item.group) ? `<small style="color:#8b0000; display:block;">[${item.group}]</small>` : "";

        return `
            <div class="index-item" data-id="${item.id}" data-type="${type}">
                <h4>${title}</h4>
                ${groupTag}
                <p><strong>信息1:</strong> ${info1}</p>
                <p><strong>信息2:</strong> ${info2}</p>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.index-item').forEach(item => {
        item.addEventListener('click', () => {
            showIndexItemDetail(item.getAttribute('data-id'), item.getAttribute('data-type'));
        });
    });
}

// 核心修正：从缓存中调取 JSON 详情并显示在弹窗
function showIndexItemDetail(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const list = indexDataCache[itemType] || [];
    const item = list.find(d => d.id == itemId);
    if(!item) return;

    modalTitle.textContent = item.name || item.title || item.phrase || "详细信息";
    let html = "";
    
    if (itemType === 'persons') {
        html = `
            <div class="rich-detail">
                <p><strong>籍册：</strong><span style="color:#8b0000; font-weight:bold;">${item.group || '未入册'}</span></p>
                <p><strong>身份：</strong>${item.identity || '未知'}</p>
                <p><strong>家族：</strong>${item.family || '未知'}</p>
                <hr>
                <p><strong>描述：</strong></p>
                <p style="line-height:1.8; text-indent:2em;">${item.description || '暂无描述'}</p>
            </div>`;
    } else if (itemType === 'poems') {
        html = `<p><strong>作者：</strong>${item.author} | <strong>章节：</strong>${item.chapter}</p>
                <div style="background:#fdfcf8; padding:20px; border:1px solid #ddd; white-space:pre-wrap; text-align:center; font-family:serif; line-height:2;">${item.content}</div>`;
    } else if (itemType === 'proverbs') {
        html = `<p><strong>出处：</strong>${item.source}</p><p><strong>释义：</strong>${item.meaning}</p><blockquote style="border-left:4px solid #8b0000; padding:10px; font-style:italic;">"${item.content}"</blockquote>`;
    } else {
        html = `<p>${item.description || item.meaning || '暂无详细内容'}</p>`;
    }
    
    modalBody.innerHTML = html;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
}

// 原原本本复刻：搜索逻辑
function initSearch() {
    const input = document.getElementById('global-search');
    const btn = document.getElementById('search-btn');
    btn?.addEventListener('click', () => {
        const query = input.value.trim().toLowerCase();
        if (!query) return;
        const res = characters.find(c => c.name.includes(query));
        if(res) { showSection('characters'); setTimeout(() => showCharacterDetail(res), 200); }
    });
}

function showEventModal(ev) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').textContent = ev.title || "详情";
    document.getElementById('modal-body').innerHTML = `
        <p><strong>时间：</strong>第${ev.year}年 · ${ev.chapter || ''}</p>
        <p style="margin-top:10px; line-height:1.6;">${ev.description}</p>
    `;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
}

// 复刻：辅助函数与颜色
function getEventCategoryLabel(cat) { return {'family':'家族兴衰','love':'情感主线','fate':'命运转折','social':'社会事件'}[cat] || '其他'; }
function getTypeLabel(type) { return {'main':'主要人物','major':'重要人物','minor':'次要人物'}[type] || '其他'; }
function getNodeColor(t) { return {'main':'#8b0000','major':'#d4af37','minor':'#2e8b57'}[t] || '#6c757d'; }
function getNodeRadius(t) { return {'main':25,'major':20,'minor':15}[t] || 10; }
function getLinkColor(t) { return {'blood':'#dc3545','marriage':'#28a745','master-servant':'#fd7e14','emotional':'#17a2b8','family':'#6f42c1'}[t] || '#999'; }
