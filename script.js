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
    const graphContainer = document.getElementById('relationship-graph');
    if (!graphContainer) {
        console.error('找不到图谱容器');
        return;
    }
    
    // 如果没有数据
    if (characters.length === 0 || relationships.length === 0) {
        graphContainer.innerHTML = `
            <div class="no-data-message">
                <i class="fas fa-exclamation-circle"></i>
                <h3>无可用数据</h3>
                <p>请确保data目录下有正确的JSON文件</p>
            </div>
        `;
        return;
    }
    
    // 设置容器尺寸
    const width = graphContainer.clientWidth || 800;
    const height = graphContainer.clientHeight || 600;
    
    // 清空容器
    graphContainer.innerHTML = '';
    
    // 创建SVG
    const svg = d3.select('#relationship-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .attr('style', 'max-width: 100%; height: auto;');
    
    // 添加缩放和平移
    const g = svg.append('g');
    
    // 创建力导向图
    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    
    // 准备节点数据
    const nodes = characters.map(char => ({
        id: char.id,
        name: char.name,
        type: char.type || 'other',
        group: char.group || 'unknown',
        family: char.family || '未知',
        ...char
    }));
    
    // 准备边数据
    const links = relationships.map(rel => ({
        source: rel.source,
        target: rel.target,
        type: rel.type || 'other',
        label: rel.label || '关系'
    }));
    
    // 添加箭头标记
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
    
    // 添加边
    const link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('class', 'link')
        .attr('stroke', d => getLinkColor(d.type))
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6)
        .attr('marker-end', 'url(#arrow)');
    
    // 添加节点
    const node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    
    // 添加节点圆圈
    node.append('circle')
        .attr('r', d => getNodeRadius(d.type))
        .attr('fill', d => getNodeColor(d.type))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer');
    
    // 添加节点文本
    node.append('text')
        .text(d => d.name)
        .attr('x', 0)
        .attr('y', d => getNodeRadius(d.type) + 15)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#333')
        .style('pointer-events', 'none');
    
    // 添加节点悬停效果
    node.on('mouseover', function(event, d) {
        // 高亮当前节点
        d3.select(this).select('circle')
            .attr('stroke', '#ff6b6b')
            .attr('stroke-width', 3);
        
        // 高亮相关边
        link.attr('stroke-opacity', l => 
            (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
        );
    })
    .on('mouseout', function(event, d) {
        // 恢复节点样式
        d3.select(this).select('circle')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        
        // 恢复边样式
        link.attr('stroke-opacity', 0.6);
    })
    .on('click', function(event, d) {
        // 显示节点详情
        showCharacterDetail(d);
        
        // 居中显示该节点
        const scale = 2;
        const x = width / 2 - d.x * scale;
        const y = height / 2 - d.y * scale;
        
        g.transition()
            .duration(750)
            .attr('transform', `translate(${x},${y}) scale(${scale})`);
    });
    
    // 添加缩放功能
    svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        }));
    
    // 更新力模拟
    simulation.nodes(nodes);
    simulation.force('link').links(links);
    simulation.alpha(1).restart();
    
    // 在tick事件中更新位置
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // 保存当前图实例
    currentGraph = {
        simulation,
        center: function() {
            g.transition()
                .duration(750)
                .attr('transform', 'translate(0,0) scale(1)');
        }
    };
    
    // 拖拽函数
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
}

// 显示人物详情
function showCharacterDetail(character) {
    const detailPanel = document.getElementById('character-detail');
    if (!detailPanel) return;
    
    // 获取相关关系
    const relatedRelationships = relationships.filter(r => 
        r.source === character.id || r.target === character.id
    );
    
    // 获取相关人物
    const relatedCharacters = relatedRelationships.map(rel => {
        const otherId = rel.source === character.id ? rel.target : rel.source;
        const otherChar = characters.find(c => c.id === otherId);
        return otherChar ? {
            name: otherChar.name,
            relation: rel.label,
            type: rel.type
        } : null;
    }).filter(Boolean);
    
    // 构建详情HTML
    detailPanel.innerHTML = `
        <div class="character-detail">
            <div class="character-header">
                <h3>${character.name}</h3>
                <span class="character-badge">${getTypeLabel(character.type)}</span>
            </div>
            
            <div class="character-info">
                <div class="info-row">
                    <strong>身份：</strong>
                    <span>${character.identity || '未指定'}</span>
                </div>
                <div class="info-row">
                    <strong>家族：</strong>
                    <span>${character.family || '未指定'}</span>
                </div>
                <div class="info-row">
                    <strong>地位：</strong>
                    <span>${character.status || '未指定'}</span>
                </div>
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

// 获取节点颜色
function getNodeColor(type) {
    const colors = {
        'main': '#8b0000',    // 主要人物 - 深红色
        'major': '#d4af37',   // 重要人物 - 金色
        'minor': '#2e8b57',   // 次要人物 - 绿色
        'other': '#6c757d'    // 其他人物 - 灰色
    };
    return colors[type] || '#6c757d';
}

// 获取节点半径
function getNodeRadius(type) {
    const radii = {
        'main': 25,
        'major': 20,
        'minor': 15,
        'other': 10
    };
    return radii[type] || 10;
}

// 获取连线颜色
function getLinkColor(type) {
    const colors = {
        'blood': '#dc3545',       // 血缘关系 - 红色
        'marriage': '#28a745',    // 姻亲关系 - 绿色
        'master-servant': '#fd7e14', // 主仆关系 - 橙色
        'emotional': '#17a2b8',   // 情感关系 - 蓝色
        'family': '#6f42c1'       // 家族关系 - 紫色
    };
    return colors[type] || '#6c757d';
}

// 获取类型标签
function getTypeLabel(type) {
    const labels = {
        'main': '主要人物',
        'major': '重要人物',
        'minor': '次要人物',
        'other': '其他人物'
    };
    return labels[type] || '未知';
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
