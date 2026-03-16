// 全局变量
let characters = [];
let relationships =[];
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
        
        // 初始化各个页面
        initNavigation();
        initHomePage();
        initCharacterGraph();
        initTimeline();
        initEvents();
        initIndex();
        initSearch();
        
        // 显示首页
        showSection('home');
    }).catch(error => {
        console.error('加载核心数据失败 (可能是代码逻辑错误):', error);
        alert('部分页面组件初始化失败，请按F12查看控制台报错');
    });
});

// 数据加载 (🌟已修改：增加容错处理，缺失文件不再导致页面崩溃)
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // 如果报 404 等错误，只在控制台警告，不抛出异常
            console.warn(`⚠️ 提示: 找不到文件或加载失败 ${url} (状态码: ${response.status})。将使用空数据继续。`);
            return[]; // 返回空数组，防止后续 .length 或 .map 报错
        }
        return await response.json();
    } catch (error) {
        // 捕获网络异常
        console.warn(`⚠️ 提示: 网络请求异常 ${url}`, error);
        return[]; // 同样返回空数组
    }
}

// 更新统计数据
function updateStatistics() {
    // 增加安全判断，防止 characters 或 relationships 甚至不是数组
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
            
            // 更新激活状态
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // 显示对应部分
            showSection(target);
        });
    });
}

// 显示对应部分
function showSection(sectionId) {
    // 隐藏所有部分
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 显示目标部分
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // 如果是图谱页面，重新计算布局
    if (sectionId === 'characters' && currentGraph) {
        setTimeout(() => {
            currentGraph.centerGraph();
        }, 100);
    }
}

// 首页初始化
function initHomePage() {
    // 快速链接
    const quickLinks = document.querySelectorAll('.link-card');
    quickLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            
            // 更新导航状态
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelector(`.nav-link[href="#${target}"]`).classList.add('active');
            
            // 显示对应部分
            showSection(target);
        });
    });
}

// 人物关系图初始化
function initCharacterGraph() {
    const graphElement = document.querySelector('#relationship-graph');
    if (!graphElement || characters.length === 0) return; // 如果没有数据或元素，直接跳过初始化

    const width = graphElement.offsetWidth;
    const height = graphElement.offsetHeight;
    
    // 创建力导向图
    const svg = d3.select('#relationship-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => {
            svgGroup.attr('transform', event.transform);
        }))
        .append('g');
    
    const svgGroup = svg.append('g');
    
    // 定义箭头
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
    
    // 创建力模拟
    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(50));
    
    // 创建图数据结构
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
    
    // 创建连线
    const link = svgGroup.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('stroke', d => getRelationshipColor(d.type))
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)');
    
    // 创建连线标签
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
    
    // 创建节点
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
    
    // 添加节点圆圈
    node.append('circle')
        .attr('r', 20)
        .attr('fill', d => getNodeColor(d.type))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    
    // 添加节点文字
    node.append('text')
        .attr('class', 'node-label')
        .text(d => d.name)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('font-size', 12)
        .attr('fill', '#333')
        .style('pointer-events', 'none');
    
    // 添加点击事件
    node.on('click', (event, d) => {
        showCharacterDetail(d);
        highlightConnections(d.id);
    });
    
    // 更新力模拟
    simulation.nodes(nodes).on('tick', ticked);
    simulation.force('link').links(links);
    
    // 添加双击重置事件
    svg.on('dblclick.zoom', () => {
        svgGroup.transition().duration(750)
            .attr('transform', 'translate(0,0) scale(1)');
    });
    
    // 过滤器
    const relationFilter = document.getElementById('relation-filter');
    const familyFilter = document.getElementById('family-filter');
    const resetViewBtn = document.getElementById('reset-view');

    if(relationFilter) relationFilter.addEventListener('change', function() {
        const type = this.value;
        filterGraph(type, document.getElementById('family-filter').value);
    });
    
    if(familyFilter) familyFilter.addEventListener('change', function() {
        const family = this.value;
        filterGraph(document.getElementById('relation-filter').value, family);
    });
    
    if(resetViewBtn) resetViewBtn.addEventListener('click', () => {
        svgGroup.transition().duration(750)
            .attr('transform', 'translate(0,0) scale(1)');
        resetFilters();
    });
    
    // 工具函数
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
            r.source.id === character.id || r.target.id === character.id ||
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
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .character-detail { padding: 1rem; }
            .character-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                margin-bottom: 1rem; 
                padding-bottom: 0.5rem; 
                border-bottom: 1px solid #eee; 
            }
            .character-type { 
                background: ${getNodeColor(character.type)}; 
                color: white; 
                padding: 0.25rem 0.75rem; 
                border-radius: 20px; 
                font-size: 0.8rem; 
            }
            .character-desc { 
                color: #666; 
                margin-bottom: 1rem; 
                line-height: 1.6; 
            }
            .character-info { 
                background: #f8f9fa; 
                padding: 1rem; 
                border-radius: 4px; 
                margin-bottom: 1rem; 
            }
            .info-item { 
                margin-bottom: 0.5rem; 
                display: flex; 
            }
            .info-item strong { 
                min-width: 60px; 
                color: #333; 
            }
            .relationships h4, .character-events h4 { 
                color: #333; 
                margin-bottom: 0.5rem; 
            }
            .relationship-list, .event-list { 
                max-height: 200px; 
                overflow-y: auto; 
            }
            .relationship-item, .event-item { 
                padding: 0.5rem; 
                background: white; 
                border: 1px solid #eee; 
                border-radius: 4px; 
                margin-bottom: 0.5rem; 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
            }
            .rel-name { 
                font-weight: bold; 
                color: #333; 
            }
            .rel-type { 
                font-size: 0.8rem; 
                padding: 0.1rem 0.5rem; 
                border-radius: 3px; 
                background: #f0f0f0; 
            }
            .rel-type.blood { background: #f8d7da; color: #721c24; }
            .rel-type.marriage { background: #d4edda; color: #155724; }
            .rel-type.master-servant { background: #fff3cd; color: #856404; }
            .rel-type.emotional { background: #d1ecf1; color: #0c5460; }
        `;
        detailPanel.appendChild(style);
    }
    
    function highlightConnections(characterId) {
        // 重置所有节点和连线
        svgGroup.selectAll('.node circle').attr('stroke', '#fff').attr('stroke-width', 2);
        svgGroup.selectAll('line').attr('stroke-width', 2);
        
        // 高亮选中的节点
        svgGroup.selectAll('.node').filter(d => d.id === characterId)
            .select('circle')
            .attr('stroke', '#ff6b6b')
            .attr('stroke-width', 3);
        
        // 高亮相关连线
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
        let filteredNodes = [...nodes];
        
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
        
        // 更新图
        const remainingNodeIds = new Set();
        filteredLinks.forEach(link => {
            remainingNodeIds.add(link.source.id);
            remainingNodeIds.add(link.target.id);
        });
        
        if (filteredNodes.length === 0) {
            filteredNodes = nodes.filter(node => remainingNodeIds.has(node.id));
        }
        
        // 更新显示
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
    
    // 保存图实例
    currentGraph = {
        svg,
        simulation,
        centerGraph: () => {
            svgGroup.transition().duration(750)
                .attr('transform', `translate(0,0) scale(1)`)
                .attr('transform', `translate(${width/2},${height/2}) scale(1)`)
                .transition()
                .attr('transform', 'translate(0,0) scale(1)');
        }
    };
}

// 时间轴初始化
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return; // 空数据跳过
    
    // 创建时间轴数据
    const timelineData = timeline.map(item => ({
        id: item.id,
        content: item.event,
        start: item.year + '-01-01',
        end: item.year + '-12-31',
        type: 'range',
        className: item.type || 'default',
        title: item.chapter || '',
        description: item.description || ''
    }));
    
    // 创建时间轴选项
    const options = {
        width: '100%',
        height: '100%',
        min: '1-01-01',
        max: '15-12-31',
        start: '1-01-01',
        end: '15-12-31',
        zoomMin: 1000 * 60 * 60 * 24 * 365, // 1年
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 20, // 20年
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
    
    // 创建时间轴 (假设 vis 对象存在)
    if (typeof vis !== 'undefined') {
        const timelineInstance = new vis.Timeline(container, timelineData, options);
        
        // 添加控制
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const fitBtn = document.getElementById('fit-timeline');

        if(zoomInBtn) zoomInBtn.addEventListener('click', () => {
            const range = timelineInstance.getWindow();
            const zoom = (range.end - range.start) * 0.7;
            const center = (range.start + range.end) / 2;
            timelineInstance.setWindow(center - zoom/2, center + zoom/2);
        });
        
        if(zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
            const range = timelineInstance.getWindow();
            const zoom = (range.end - range.start) * 1.3;
            const center = (range.start + range.end) / 2;
            timelineInstance.setWindow(center - zoom/2, center + zoom/2);
        });
        
        if(fitBtn) fitBtn.addEventListener('click', () => {
            timelineInstance.fit();
        });
        
        // 添加点击事件
        timelineInstance.on('click', function(properties) {
            if (properties.item) {
                const item = timelineData.find(d => d.id == properties.item);
                if (item) {
                    showEventModal(item);
                }
            }
        });
    }
}

// 事件页面初始化
function initEvents() {
    const container = document.getElementById('events-container');
    if(!container) return;
    
    // 渲染事件卡片
    function renderEvents(filteredEvents = events) {
        if(filteredEvents.length === 0) {
            container.innerHTML = '<p class="text-center">暂无相关事件数据</p>';
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
        
        // 添加点击事件
        document.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const eventId = card.getAttribute('data-id');
                const event = events.find(e => e.id == eventId);
                if (event) {
                    showEventModal(event);
                }
            });
        });
    }
    
    // 初始渲染
    renderEvents();
    
    // 搜索功能
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
    
    // 分类过滤
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
            
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 显示对应标签页
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            const activeTab = document.getElementById(`${tabId}-tab`);
            if(activeTab) activeTab.classList.add('active');
            
            // 加载数据
            loadIndexData(tabId);
        });
    });
    
    // 加载初始数据
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
                        ${item.description ? `<p>${item.description.substring(0, 50)}...</p>` : ''}
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
                        <p>${item.description ? item.description.substring(0, 60) : ''}...</p>
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
                        <p>${item.description ? item.description.substring(0, 60) : ''}...</p>
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
                        <p>${item.content ? item.content.substring(0, 60) : ''}...</p>
                    </div>
                `;
                break;
                
            case 'proverbs':
                data = await fetchData('data/proverbs.json');
                template = (item) => `
                    <div class="index-item" data-id="${item.id}" data-type="proverb">
                        <h4>${item.phrase}</h4>
                        <p><strong>出处:</strong> ${item.source || '未指定'}</p>
                        <p><strong>含义:</strong> ${item.meaning ? item.meaning.substring(0, 60) : ''}...</p>
                    </div>
                `;
                break;
        }
        
        if (data.length === 0) {
            tabElement.innerHTML = '<p class="text-center" style="width:100%; color:#999;">该分类暂无数据文件</p>';
        } else {
            tabElement.innerHTML = data.slice(0, 50).map(template).join('');
            
            // 添加点击事件
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
        tabElement.innerHTML = '<p class="error">加载数据失败，请稍后重试</p>';
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
        
        // 搜索所有数据类型
        const allData =[
            ...characters.map(c => ({...c, type: 'character'})),
            ...events.map(e => ({...e, type: 'event'})),
            ...timeline.map(t => ({...t, type: 'timeline'}))
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
                    <div class="search-result-item" data-id="${item.id}" data-type="${item.type}">
                        <h4>${item.name || item.title || item.event || '未命名'}</h4>
                        <p><small>类型: ${getTypeLabel(item.type)}</small></p>
                        <p>${(item.description || item.content || '').substring(0, 100)}...</p>
                    </div>
                `).join('')}
            </div>
        `;
        
        // 添加点击事件
        modalBody.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const itemId = item.getAttribute('data-id');
                const itemType = item.getAttribute('data-type');
                modal.classList.remove('active');
                
                if (itemType === 'character') {
                    const character = characters.find(c => c.id == itemId);
                    if (character) {
                        showSection('characters');
                        const detailPanel = document.getElementById('character-detail');
                        setTimeout(() => {
                            if (currentGraph) {
                                d3.select('#relationship-graph').selectAll('.node')
                                    .filter(d => d.id == itemId)
                                    .dispatch('click');
                            }
                        }, 100);
                    }
                } else if (itemType === 'event') {
                    const event = events.find(e => e.id == itemId);
                    if (event) {
                        showEventModal(event);
                    }
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
    
    modalTitle.textContent = event.title;
    
    modalBody.innerHTML = `
        <div class="event-modal-content">
            <div class="event-meta">
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>时间: 第${event.year}年 · ${event.season}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-book-open"></i>
                    <span>章节: ${event.chapter}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-tag"></i>
                    <span>分类: ${getEventCategoryLabel(event.category)}</span>
                </div>
            </div>
            
            <div class="event-content">
                <h4>事件描述</h4>
                <p>${event.description}</p>
                
                ${event.characters && event.characters.length > 0 ? `
                <div class="event-characters-list">
                    <h4>涉及人物</h4>
                    <div class="character-tags">
                        ${event.characters.map(char => `
                            <span class="character-tag">${char}</span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${event.significance ? `
                <div class="event-significance">
                    <h4>事件意义</h4>
                    <p>${event.significance}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    
    // 绑定关闭逻辑
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        closeBtn.dataset.bound = true;
    }
    
    if (!modal.dataset.bound) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
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
            <p>ID: ${itemId}</p>
            <p>类型: ${getTypeLabel(itemType)}</p>
            <p>详细功能需根据具体数据完善。</p>
        </div>
    `;
    
    modal.classList.add('active');
}

// 辅助函数
function getEventCategoryLabel(category) {
    const labels = {
        'family': '家族兴衰',
        'love': '情感主线',
        'fate': '命运转折',
        'social': '社会事件',
        'default': '其他事件'
    };
    return labels[category] || category;
}

function getTypeLabel(type) {
    const labels = {
        'character': '人物',
        'event': '事件',
        'timeline': '时间轴',
        'item': '器物',
        'festival': '节日',
        'poem': '诗词',
        'proverb': '俗语'
    };
    return labels[type] || type;
}
