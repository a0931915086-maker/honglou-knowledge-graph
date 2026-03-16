// 全局变量
let characters =[];
let relationships = [];
let events = [];
let timeline =[];
let currentGraph = null;
let currentSelectedNode = null;

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
        
        // 更新统计数据
        updateStatistics();
        
        // 初始化各个页面 (哪怕其中一个失败，也不要影响其他的)
        initNavigation();
        initHomePage();
        initCharacterGraph();
        
        // 增加容错隔离：如果时间轴初始化报错，不会阻断后续代码
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

// 数据加载 (带容错机制)
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`⚠️ 提示: 找不到文件 ${url} (状态码: ${response.status})。将使用空数据继续。`);
            return[]; 
        }
        return await response.json();
    } catch (error) {
        console.warn(`⚠️ 提示: 网络请求异常 ${url}`, error);
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
            currentGraph.centerGraph();
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

// 人物关系图初始化
function initCharacterGraph() {
    const graphElement = document.querySelector('#relationship-graph');
    if (!graphElement || characters.length === 0) return;

    const width = graphElement.offsetWidth;
    const height = graphElement.offsetHeight;
    
    const svg = d3.select('#relationship-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => {
            svgGroup.attr('transform', event.transform);
        }))
        .append('g');
    
    const svgGroup = svg.append('g');
    
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 13)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('xoverflow', 'visible')
        .append('svg:path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', '#999')
        .style('stroke', 'none');
    
    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(50));
    
    const nodes = characters.map(char => ({
        id: char.id,
        name: char.name,
        type: char.type,
        group: char.group,
        description: char.description
    }));
    
    const links = relationships.map(rel => ({
        source: rel.source,
        target: rel.target,
        type: rel.type,
        label: rel.label
    }));
    
    const link = svgGroup.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke', d => getRelationshipColor(d.type))
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)');
    
    const linkLabels = svgGroup.append('g')
        .selectAll('text')
        .data(links)
        .enter()
        .append('text')
        .attr('class', 'link-label')
        .text(d => d.label)
        .attr('font-size', 10)
        .attr('fill', '#666')
        .attr('text-anchor', 'middle');
    
    const node = svgGroup.append('g')
        .selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    node.append('circle')
        .attr('r', 20)
        .attr('fill', d => getNodeColor(d.type))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    
    node.append('text')
        .attr('class', 'node-label')
        .text(d => d.name)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('font-size', 12)
        .attr('fill', '#333')
        .style('pointer-events', 'none');
    
    node.on('click', (event, d) => {
        showCharacterDetail(d);
        highlightConnections(d.id);
    });
    
    simulation.nodes(nodes).on('tick', ticked);
    simulation.force('link').links(links);
    
    svg.on('dblclick.zoom', () => {
        svgGroup.transition().duration(750)
            .attr('transform', 'translate(0,0) scale(1)');
    });
    
    const relationFilter = document.getElementById('relation-filter');
    const familyFilter = document.getElementById('family-filter');
    const resetViewBtn = document.getElementById('reset-view');

    if(relationFilter) relationFilter.addEventListener('change', function() {
        const type = this.value;
        filterGraph(type, document.getElementById('family-filter') ? document.getElementById('family-filter').value : 'all');
    });
    
    if(familyFilter) familyFilter.addEventListener('change', function() {
        const family = this.value;
        filterGraph(document.getElementById('relation-filter') ? document.getElementById('relation-filter').value : 'all', family);
    });
    
    if(resetViewBtn) resetViewBtn.addEventListener('click', () => {
        svgGroup.transition().duration(750)
            .attr('transform', 'translate(0,0) scale(1)');
        resetFilters();
    });
    
    function ticked() {
        link.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        linkLabels.attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2)
            .attr('dx', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                return Math.cos(Math.atan2(dy, dx)) * 15;
            })
            .attr('dy', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                return Math.sin(Math.atan2(dy, dx)) * 15;
            });
        
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    }
    
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    function getNodeColor(type) {
        const colors = {
            'main': '#8b0000',
            'major': '#d4af37',
            'minor': '#2e8b57',
            'other': '#6c757d'
        };
        return colors[type] || '#6c757d';
    }
    
    function getRelationshipColor(type) {
        const colors = {
            'blood': '#dc3545',
            'marriage': '#28a745',
            'master-servant': '#fd7e14',
            'emotional': '#17a2b8'
        };
        return colors[type] || '#6c757d';
    }
    
    function showCharacterDetail(character) {
        const detailPanel = document.getElementById('character-detail');
        if(!detailPanel) return;

        const connections = relationships.filter(r => 
            (r.source && r.source.id === character.id) || 
            (r.target && r.target.id === character.id) ||
            r.source === character.id || r.target === character.id
        );
        
        const relatedCharacters = connections.map(conn => {
            const sourceId = conn.source.id || conn.source;
            const targetId = conn.target.id || conn.target;
            const otherId = sourceId === character.id ? targetId : sourceId;
            const otherChar = characters.find(c => c.id === otherId);
            return otherChar ? {
                name: otherChar.name,
                relation: conn.label,
                type: conn.type
            } : null;
        }).filter(Boolean);
        
        detailPanel.innerHTML = `
            <div class="character-detail">
                <div class="character-header">
                    <h3>${character.name}</h3>
                    <span class="character-type">${getTypeLabel(character.type)}</span>
                </div>
                <p class="character-desc">${character.description || '暂无详细描述'}</p>
                
                <div class="character-info">
                    <div class="info-item">
                        <strong>身份：</strong>
                        <span>${character.identity || '未指定'}</span>
                    </div>
                    <div class="info-item">
                        <strong>家族：</strong>
                        <span>${character.family || '未指定'}</span>
                    </div>
                    <div class="info-item">
                        <strong>地位：</strong>
                        <span>${character.status || '未指定'}</span>
                    </div>
                </div>
                
                ${relatedCharacters.length > 0 ? `
                <div class="relationships">
                    <h4>主要关系</h4>
                    <div class="relationship-list">
                        ${relatedCharacters.map(rel => `
                            <div class="relationship-item">
                                <span class="rel-name">${rel.name}</span>
                                <span class="rel-type ${rel.type}">${rel.relation}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${character.events && character.events.length > 0 ? `
                <div class="character-events">
                    <h4>相关事件</h4>
                    <div class="event-list">
                        ${character.events.slice(0, 5).map(event => `
                            <div class="event-item">
                                <i class="fas fa-calendar-day"></i>
                                <span>${event}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        currentSelectedNode = character;
        
        if (!document.getElementById('char-detail-styles')) {
            const style = document.createElement('style');
            style.id = 'char-detail-styles';
            style.textContent = `
                .character-detail { padding: 1rem; }
                .character-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #eee; }
                .character-type { color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem; background: #6c757d;}
                .character-desc { color: #666; margin-bottom: 1rem; line-height: 1.6; }
                .character-info { background: #f8f9fa; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
                .info-item { margin-bottom: 0.5rem; display: flex; }
                .info-item strong { min-width: 60px; color: #333; }
                .relationships h4, .character-events h4 { color: #333; margin-bottom: 0.5rem; }
                .relationship-list, .event-list { max-height: 200px; overflow-y: auto; }
                .relationship-item, .event-item { padding: 0.5rem; background: white; border: 1px solid #eee; border-radius: 4px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
                .rel-name { font-weight: bold; color: #333; }
                .rel-type { font-size: 0.8rem; padding: 0.1rem 0.5rem; border-radius: 3px; background: #f0f0f0; }
                .rel-type.blood { background: #f8d7da; color: #721c24; }
                .rel-type.marriage { background: #d4edda; color: #155724; }
                .rel-type.master-servant { background: #fff3cd; color: #856404; }
                .rel-type.emotional { background: #d1ecf1; color: #0c5460; }
            `;
            document.head.appendChild(style);
        }
    }
    
    function highlightConnections(characterId) {
        svgGroup.selectAll('.node circle').attr('stroke', '#fff').attr('stroke-width', 2);
        svgGroup.selectAll('line').attr('stroke-width', 2);
        
        svgGroup.selectAll('.node').filter(d => d.id === characterId)
            .select('circle')
            .attr('stroke', '#ff6b6b')
            .attr('stroke-width', 3);
        
        const relatedLinks = links.filter(link => 
            link.source.id === characterId || link.target.id === characterId
        );
        
        relatedLinks.forEach(link => {
            svgGroup.selectAll('line').filter(d => 
                d.source.id === link.source.id && d.target.id === link.target.id
            ).attr('stroke-width', 4);
        });
    }
    
    function filterGraph(relationType, family) {
        let filteredLinks = [...links];
        let filteredNodes =[...nodes];
        
        if (relationType !== 'all') {
            filteredLinks = filteredLinks.filter(link => link.type === relationType);
        }
        
        if (family !== 'all') {
            filteredNodes = filteredNodes.filter(node => {
                const char = characters.find(c => c.id === node.id);
                return char && char.family === family;
            });
            
            const filteredNodeIds = filteredNodes.map(n => n.id);
            filteredLinks = filteredLinks.filter(link => 
                filteredNodeIds.includes(link.source.id) && filteredNodeIds.includes(link.target.id)
            );
        }
        
        const remainingNodeIds = new Set();
        filteredLinks.forEach(link => {
            remainingNodeIds.add(link.source.id);
            remainingNodeIds.add(link.target.id);
        });
        
        if (filteredNodes.length === 0) {
            filteredNodes = nodes.filter(node => remainingNodeIds.has(node.id));
        }
        
        node.style('display', d => 
            filteredNodes.some(n => n.id === d.id) ? 'block' : 'none'
        );
        
        link.style('display', d => 
            filteredLinks.some(l => l.source.id === d.source.id && l.target.id === d.target.id) ? 'block' : 'none'
        );
        
        linkLabels.style('display', d => 
            filteredLinks.some(l => l.source.id === d.source.id && l.target.id === d.target.id) ? 'block' : 'none'
        );
    }
    
    function resetFilters() {
        if(document.getElementById('relation-filter')) document.getElementById('relation-filter').value = 'all';
        if(document.getElementById('family-filter')) document.getElementById('family-filter').value = 'all';
        
        node.style('display', 'block');
        link.style('display', 'block');
        linkLabels.style('display', 'block');
    }
    
    currentGraph = {
        svg,
        simulation,
        centerGraph: () => {
            svgGroup.transition().duration(750)
                .attr('transform', `translate(${width/2},${height/2}) scale(1)`)
                .transition()
                .attr('transform', 'translate(0,0) scale(1)');
        }
    };
}

// 时间轴初始化 (✨ 已完美修复 NaN 报错问题)
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;
    
    try {
        // 创建时间轴数据
        const timelineData = timeline.map(item => {
            // ⭐ 关键修复: 将 1, 15 这样的年份强制补齐为 4 位数的标准格式 "0001", "0015"
            // 否则 Date.parse 解析会失败并返回 NaN
            const yearNum = parseInt(item.year) || 1;
            const yearStr = String(yearNum).padStart(4, '0');

            return {
                id: item.id,
                content: item.event,
                start: `${yearStr}-01-01`,  // 变成了标准的 '0001-01-01'
                end: `${yearStr}-12-31`,    // 变成了标准的 '0001-12-31'
                type: 'range',
                className: item.type || 'default',
                title: item.chapter || '',
                description: item.description || ''
            };
        });
        
        // 创建时间轴选项
        const options = {
            width: '100%',
            height: '100%',
            // ⭐ 关键修复: 这里也必须使用标准的 4 位数年份
            min: '0001-01-01',
            max: '0020-12-31', 
            start: '0001-01-01',
            end: '0015-12-31',
            zoomMin: 1000 * 60 * 60 * 24 * 365, 
            zoomMax: 1000 * 60 * 60 * 24 * 365 * 20, 
            moveable: true,
            zoomable: true,
            orientation: {
                axis: 'both',
                item: 'top'
            },
            tooltip: {
                followMouse: true,
                overflowMethod: 'cap'
            },
            format: {
                minorLabels: {
                    year: 'YYYY年'
                }
            }
        };
        
        if (typeof vis !== 'undefined') {
            const timelineInstance = new vis.Timeline(container, timelineData, options);
            
            const zoomInBtn = document.getElementById('zoom-in');
            const zoomOutBtn = document.getElementById('zoom-out');
            const fitBtn = document.getElementById('fit-timeline');

            if(zoomInBtn) zoomInBtn.addEventListener('click', () => {
                const range = timelineInstance.getWindow();
                const zoom = (range.end - range.start) * 0.7;
                const center = (range.start.valueOf() + range.end.valueOf()) / 2;
                timelineInstance.setWindow(center - zoom/2, center + zoom/2);
            });
            
            if(zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
                const range = timelineInstance.getWindow();
                const zoom = (range.end - range.start) * 1.3;
                const center = (range.start.valueOf() + range.end.valueOf()) / 2;
                timelineInstance.setWindow(center - zoom/2, center + zoom/2);
            });
            
            if(fitBtn) fitBtn.addEventListener('click', () => {
                timelineInstance.fit();
            });
            
            timelineInstance.on('click', function(properties) {
                if (properties.item) {
                    const item = timelineData.find(d => d.id == properties.item);
                    if (item) showEventModal(item);
                }
            });
        }
    } catch (err) {
        console.error("时间轴渲染出错:", err);
        container.innerHTML = `<p style="color:red;text-align:center;padding:20px;">时间轴加载失败: ${err.message}</p>`;
    }
}

// 事件页面初始化
function initEvents() {
    const container = document.getElementById('events-container');
    if(!container) return;
    
    function renderEvents(filteredEvents = events) {
        if(filteredEvents.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">暂无相关事件数据</p>';
            return;
        }

        container.innerHTML = filteredEvents.map(event => `
            <div class="event-card" data-id="${event.id}">
                <div class="event-category">${getEventCategoryLabel(event.category)}</div>
                <h3>${event.title}</h3>
                <div class="event-time">
                    <i class="fas fa-clock"></i>
                    <span>第${event.year}年 · ${event.season} · ${event.chapter}</span>
                </div>
                <p>${event.description ? event.description.substring(0, 100) : ''}...</p>
                <div class="event-characters">
                    ${event.characters && event.characters.length > 0 ? `
                    <small>涉及人物: ${event.characters.slice(0, 3).join('、')}${event.characters.length > 3 ? '等' : ''}</small>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const eventId = card.getAttribute('data-id');
                const event = events.find(e => e.id == eventId);
                if (event) showEventModal(event);
            });
        });
    }
    
    renderEvents();
    
    const searchInput = document.getElementById('event-search');
    const categorySelect = document.getElementById('event-category');

    if(searchInput) searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const category = categorySelect ? categorySelect.value : 'all';
        
        const filtered = events.filter(event => {
            const matchesSearch = (event.title || '').toLowerCase().includes(searchTerm) ||
                                (event.description || '').toLowerCase().includes(searchTerm) ||
                                (event.characters && event.characters.some(char => 
                                    char.toLowerCase().includes(searchTerm)
                                ));
            const matchesCategory = category === 'all' || event.category === category;
            return matchesSearch && matchesCategory;
        });
        renderEvents(filtered);
    });
    
    if(categorySelect) categorySelect.addEventListener('change', function() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const category = this.value;
        
        const filtered = events.filter(event => {
            const matchesSearch = (event.title || '').toLowerCase().includes(searchTerm) ||
                                (event.description || '').toLowerCase().includes(searchTerm) ||
                                (event.characters && event.characters.some(char => 
                                    char.toLowerCase().includes(searchTerm)
                                ));
            const matchesCategory = category === 'all' || event.category === category;
            return matchesSearch && matchesCategory;
        });
        renderEvents(filtered);
    });
}

// 索引初始化
function initIndex() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    if(tabBtns.length === 0) return;
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            const activeTab = document.getElementById(`${tabId}-tab`);
            if(activeTab) activeTab.classList.add('active');
            
            loadIndexData(tabId);
        });
    });
    
    loadIndexData('persons');
}

// 加载索引数据
async function loadIndexData(type) {
    const tabElement = document.querySelector(`#${type}-tab .index-grid`);
    if(!tabElement) return;

    try {
        let data =[];
        let template = '';
        
        switch(type) {
            case 'persons':
                data = characters;
                template = (item) => `
                    <div class="index-item" data-id="${item.id}" data-type="character">
                        <h4>${item.name}</h4>
                        <p><strong>身份:</strong> ${item.identity || '未指定'}</p>
                        <p><strong>家族:</strong> ${item.family || '未指定'}</p>
                    </div>
                `;
                break;
                
            case 'items':
                data = await fetchData('data/items.json');
                template = (item) => `
                    <div class="index-item" data-id="${item.id}" data-type="item">
                        <h4>${item.name}</h4>
                        <p><strong>类别:</strong> ${item.category || '未分类'}</p>
                        <p><strong>所有者:</strong> ${item.owner || '未指定'}</p>
                    </div>
                `;
                break;
                
            case 'festivals':
                data = await fetchData('data/festivals.json');
                template = (item) => `
                    <div class="index-item" data-id="${item.id}" data-type="festival">
                        <h4>${item.name}</h4>
                        <p><strong>时间:</strong> ${item.time || '未指定'}</p>
                        <p><strong>章节:</strong> ${item.chapter || '未指定'}</p>
                    </div>
                `;
                break;
                
            case 'poems':
                data = await fetchData('data/poems.json');
                template = (item) => `
                    <div class="index-item" data-id="${item.id}" data-type="poem">
                        <h4>${item.title}</h4>
                        <p><strong>作者:</strong> ${item.author || '未指定'}</p>
                        <p><strong>章节:</strong> ${item.chapter || '未指定'}</p>
                    </div>
                `;
                break;
                
            case 'proverbs':
                data = await fetchData('data/proverbs.json');
                template = (item) => `
                    <div class="index-item" data-id="${item.id}" data-type="proverb">
                        <h4>${item.phrase}</h4>
                        <p><strong>出处:</strong> ${item.source || '未指定'}</p>
                    </div>
                `;
                break;
        }
        
        if (!data || data.length === 0) {
            tabElement.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color:#999;">该分类暂无数据</p>';
        } else {
            tabElement.innerHTML = data.slice(0, 50).map(template).join('');
            
            tabElement.querySelectorAll('.index-item').forEach(item => {
                item.addEventListener('click', () => {
                    const itemId = item.getAttribute('data-id');
                    const itemType = item.getAttribute('data-type');
                    showIndexItemDetail(itemId, itemType);
                });
            });
        }
    } catch (error) {
        console.error(`加载${type}数据失败:`, error);
        tabElement.innerHTML = '<p class="error">加载数据失败</p>';
    }
}

// 搜索初始化
function initSearch() {
    const searchInput = document.getElementById('global-search');
    const searchBtn = document.getElementById('search-btn');
    if(!searchInput || !searchBtn) return;
    
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;
        
        const allData = [
            ...(characters || []).map(c => ({...c, type: 'character'})),
            ...(events ||[]).map(e => ({...e, type: 'event'})),
            ...(timeline ||[]).map(t => ({...t, type: 'timeline'}))
        ];
        
        const results = allData.filter(item => {
            if (item.name && item.name.toLowerCase().includes(query)) return true;
            if (item.title && item.title.toLowerCase().includes(query)) return true;
            if (item.description && item.description.toLowerCase().includes(query)) return true;
            if (item.content && item.content.toLowerCase().includes(query)) return true;
            if (item.event && item.event.toLowerCase().includes(query)) return true;
            if (item.characters && item.characters.some(c => c.toLowerCase().includes(query))) return true;
            return false;
        });
        
        showSearchResults(results, query);
    }
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

// 显示搜索结果
function showSearchResults(results, query) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if(!modal) return;
    
    modalTitle.textContent = `搜索: "${query}" (${results.length}个结果)`;
    
    if (results.length === 0) {
        modalBody.innerHTML = '<p>没有找到相关结果。</p>';
    } else {
        modalBody.innerHTML = `
            <div class="search-results">
                ${results.slice(0, 20).map(item => `
                    <div class="search-result-item" data-id="${item.id}" data-type="${item.type}" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee;">
                        <h4>${item.name || item.title || item.event || '未命名'}</h4>
                        <p><small>类型: ${getTypeLabel(item.type)}</small></p>
                    </div>
                `).join('')}
            </div>
        `;
        
        modalBody.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemId = item.getAttribute('data-id');
                const itemType = item.getAttribute('data-type');
                modal.classList.remove('active');
                
                if (itemType === 'character') {
                    showSection('characters');
                    setTimeout(() => {
                        if (currentGraph) {
                            d3.select('#relationship-graph').selectAll('.node')
                                .filter(d => d.id == itemId)
                                .dispatch('click');
                        }
                    }, 100);
                } else if (itemType === 'event') {
                    const event = events.find(e => e.id == itemId);
                    if (event) showEventModal(event);
                }
            });
        });
    }
    modal.classList.add('active');
}

// 显示事件模态框
function showEventModal(event) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if(!modal) return;
    
    modalTitle.textContent = event.title || event.event || '事件详情';
    
    modalBody.innerHTML = `
        <div class="event-modal-content">
            <div class="event-meta" style="display:flex; gap:15px; margin-bottom:15px; color:#666;">
                <div class="meta-item"><i class="fas fa-calendar"></i> 年份: 第${event.year}年</div>
                ${event.chapter ? `<div class="meta-item"><i class="fas fa-book-open"></i> 章节: ${event.chapter}</div>` : ''}
            </div>
            <div class="event-content">
                <h4>描述</h4>
                <p>${event.description || event.content || '暂无描述'}</p>
                ${event.characters && event.characters.length > 0 ? `
                <div style="margin-top:15px;">
                    <h4>涉及人物</h4>
                    <p>${event.characters.join('、')}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        closeBtn.dataset.bound = true;
    }
    
    if (!modal.dataset.bound) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
        modal.dataset.bound = true;
    }
}

// 显示索引项详情
function showIndexItemDetail(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if(!modal) return;
    
    modalTitle.textContent = '项目详情';
    modalBody.innerHTML = `
        <div class="index-item-detail">
            <p><strong>类型:</strong> ${getTypeLabel(itemType)}</p>
            <p><strong>更多详情:</strong> 此处可扩展详细信息</p>
        </div>
    `;
    modal.classList.add('active');
}

// 辅助函数
function getEventCategoryLabel(category) {
    const labels = {
        'family': '家族兴衰', 'love': '情感主线', 'fate': '命运转折',
        'social': '社会事件', 'default': '其他事件'
    };
    return labels[category] || category || '未分类';
}

function getTypeLabel(type) {
    const labels = {
        'character': '人物', 'event': '事件', 'timeline': '时间轴',
        'item': '器物', 'festival': '节日', 'poem': '诗词', 'proverb': '俗语'
    };
    return labels[type] || type;
}
