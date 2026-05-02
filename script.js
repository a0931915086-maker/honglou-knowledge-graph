// 全局变量
let characters = [];
let relationships =[];
let events = [];
let timeline =[];
let currentGraph = null;
let currentSelectedNode = null;

// 详情数据缓存 (用于索引点击时调取)
let indexDataCache = {
    persons:[],
    items: [],
    festivals: [],
    poems: [],
    proverbs:[]
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
        
        // 缓存索引数据
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
    
    // 如果跳转到人物图谱，尝试居中显示
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

// --- 人物关系图谱逻辑 (融合筛选功能与聚焦跳转) ---
function initCharacterGraph() {
    const graphContainer = document.getElementById('relationship-graph');
    if (!graphContainer || characters.length === 0) return;
    
    const width = graphContainer.clientWidth || 800;
    const height = 600;
    graphContainer.innerHTML = '';
    
    const svg = d3.select('#relationship-graph').append('svg')
        .attr('width', width).attr('height', height).attr('viewBox',[0, 0, width, height]);
    
    const g = svg.append('g');
    
    // 初始化时深拷贝一份数据，避免污染原始全局变量
    let simulationNodes = JSON.parse(JSON.stringify(characters));
    let simulationLinks = JSON.parse(JSON.stringify(relationships));

    const simulation = d3.forceSimulation(simulationNodes)
        .force('link', d3.forceLink(simulationLinks).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(35));
    
    svg.append('defs').selectAll('marker')
        .data(['arrow']).enter().append('marker')
        .attr('id', d => d).attr('viewBox', '0 -5 10 10')
        .attr('refX', 28).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#999');
    
    // 定义基础选集
    let link = g.append('g').attr('class', 'links').selectAll('line');
    let node = g.append('g').attr('class', 'nodes').selectAll('g');

    // 图谱更新函数：处理筛选和重绘
    function updateGraph() {
        const relType = document.getElementById('relation-filter')?.value || 'all';
        const familyType = document.getElementById('family-filter')?.value || 'all';

        // 1. 节点筛选逻辑
        const activeNodes = characters.filter(n => 
            (familyType === 'all' || (n.family && n.family.includes(getFamilyName(familyType))))
        );

        // 获取活跃节点的 ID 集合，防止连线指向不存在的节点导致报错
        const activeNodeIds = new Set(activeNodes.map(n => n.id));

        // 2. 连线筛选逻辑
        const activeLinks = relationships.filter(l => {
            const isTypeMatch = relType === 'all' || l.type === relType;
            // 兼容 D3 force 解析过后的 source/target 对象形式和未解析的字符串形式
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            const isNodesExist = activeNodeIds.has(sourceId) && activeNodeIds.has(targetId);
            return isTypeMatch && isNodesExist;
        });

        // --- 重新渲染连线 ---
        link = link.data(activeLinks, d => {
            const s = typeof d.source === 'object' ? d.source.id : d.source;
            const t = typeof d.target === 'object' ? d.target.id : d.target;
            return `${s}-${t}`;
        });
        link.exit().remove();
        link = link.enter().append('line')
            .attr('class', 'link')
            .attr('stroke', d => getLinkColor(d.type))
            .attr('stroke-width', 2).attr('stroke-opacity', 0.6)
            .attr('marker-end', 'url(#arrow)')
            .merge(link);

        // --- 重新渲染节点 ---
        node = node.data(activeNodes, d => d.id);
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
            .attr('stroke', '#fff').attr('stroke-width', 2).style('cursor', 'pointer');
            
        nodeEnter.append('text')
            .text(d => d.name)
            .attr('x', 0)
            .attr('y', d => getNodeRadius(d.type) + 15)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px').attr('fill', '#333').style('pointer-events', 'none');

        node = nodeEnter.merge(node);

        // 绑定节点交互事件
        node.on('mouseover', function(e, d) {
            d3.select(this).select('circle').attr('stroke', '#ff6b6b').attr('stroke-width', 3);
            link.attr('stroke-opacity', l => {
                const sid = typeof l.source === 'object' ? l.source.id : l.source;
                const tid = typeof l.target === 'object' ? l.target.id : l.target;
                return (sid === d.id || tid === d.id) ? 1 : 0.1;
            });
        }).on('mouseout', function() {
            d3.select(this).select('circle').attr('stroke', '#fff').attr('stroke-width', 2);
            link.attr('stroke-opacity', 0.6);
        }).on('click', (e, d) => {
            focusOnCharacter(d);
        });

        // 更新力导向图数据并重启
        simulation.nodes(activeNodes);
        simulation.force('link').links(activeLinks);
        simulation.alpha(1).restart();
    }

    // 初始渲染
    updateGraph();

    // 绑定下拉框与重置按钮事件
    document.getElementById('relation-filter')?.addEventListener('change', updateGraph);
    document.getElementById('family-filter')?.addEventListener('change', updateGraph);
    document.getElementById('reset-view')?.addEventListener('click', () => {
        if(document.getElementById('relation-filter')) document.getElementById('relation-filter').value = 'all';
        if(document.getElementById('family-filter')) document.getElementById('family-filter').value = 'all';
        updateGraph();
        currentGraph.center();
    });
    
    svg.call(d3.zoom().extent([[0, 0], [width, height]]).scaleExtent([0.1, 4]).on('zoom', (event) => g.attr('transform', event.transform)));
    
    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // 聚焦人物的辅助函数
    function focusOnCharacter(d) {
        showCharacterDetail(d);
        const scale = 2;
        // 如果 d.x/d.y 暂无值（可能是刚加载完），提供默认保护
        const xPos = d.x || width/2;
        const yPos = d.y || height/2;
        const x = width / 2 - xPos * scale;
        const y = height / 2 - yPos * scale;
        g.transition().duration(750).attr('transform', `translate(${x},${y}) scale(${scale})`);
    }

    // 暴露供外部（如全局搜索）调用的方法
    currentGraph = { 
        center: () => g.transition().duration(750).attr('transform', 'translate(0,0) scale(1)'),
        focus: (id) => {
            // 1. 如果有筛选导致人物不在当前视图，重置视图以展示它
            if(document.getElementById('relation-filter')) document.getElementById('relation-filter').value = 'all';
            if(document.getElementById('family-filter')) document.getElementById('family-filter').value = 'all';
            updateGraph();
            
            // 2. 查找人物并居中
            // 由于 updateGraph 中的 simulation.nodes 会更新全局 characters 内对象的坐标
            setTimeout(() => {
                const d = characters.find(c => c.id == id);
                if(d) focusOnCharacter(d);
            }, 100); // 稍微延迟等待坐标初始化
        }
    };
}

// 侧边栏详情
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

// 时间轴初始化 (已修复重叠问题，按季节分布)
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) {
        container.innerHTML = '<div class="no-data-message"><i class="fas fa-calendar-times"></i><p>暂无时间轴数据</p></div>';
        return;
    }
    
    try {
        // 创建分组：每个年份的每个季节作为一个分组
        const groups = new vis.DataSet();
        const eventsData = [];
        
        // 遍历事件，创建分组和事件
        timeline.forEach(item => {
            const yearNum = parseInt(item.year) || 1;
            const season = item.season || '未知';
            
            // 创建分组ID：年份-季节
            const groupId = `${yearNum}-${season}`;
            
            // 如果分组不存在，添加分组
            if (!groups.get(groupId)) {
                groups.add({
                    id: groupId,
                    content: `第${yearNum}年 ${season}`,
                    className: `timeline-group ${season}-group`,
                    order: (yearNum * 10) + getSeasonOrder(season)
                });
            }
            
            // 根据季节计算具体日期
            const seasonDates = getSeasonDates(yearNum, season);
            
            // 创建事件
            eventsData.push({
                id: item.id,
                group: groupId,
                content: `<div class="timeline-event">
                            <strong>${item.event}</strong>
                            <div class="event-chapter">${item.chapter}</div>
                          </div>`,
                start: seasonDates.start,
                end: seasonDates.end,
                type: 'range',
                className: `timeline-item ${item.type}`,
                title: `${item.event} (${item.chapter})`,
                description: item.description || '',
                year: yearNum,
                season: season
            });
        });
        
        // 创建时间轴选项
        const options = {
            width: '100%',
            height: '600px',
            min: '0001-01-01',
            max: '0020-12-31',
            start: '0001-01-01',
            end: '0015-12-31',
            zoomMin: 1000 * 60 * 60 * 24 * 30 * 3, // 最小缩放为3个月
            zoomMax: 1000 * 60 * 60 * 24 * 365 * 20, // 最大缩放为20年
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
            },
            // 分组配置
            groupOrder: 'order',
            groupHeightMode: 'fixed',
            stack: false, // 禁用堆叠，确保事件不重叠
            stackSubgroups: false,
            verticalScroll: true,
            maxHeight: 600
        };
        
        if (typeof vis !== 'undefined') {
            // 创建时间轴实例
            const timelineInstance = new vis.Timeline(container, eventsData, groups, options);
            
            // 添加控件事件监听
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
            
            // 点击事件显示详情
            timelineInstance.on('click', function(properties) {
                if (properties.item) {
                    const event = timeline.find(e => e.id == properties.item);
                    if (event) showEventModal(event);
                }
            });
            
            // 添加悬停效果
            timelineInstance.on('mouseOver', function(properties) {
                if (properties.item) {
                    timelineInstance.setItemCSS(properties.item, {
                        'box-shadow': '0 4px 8px rgba(0,0,0,0.2)',
                        'transform': 'scale(1.05)',
                        'transition': 'all 0.3s ease'
                    });
                }
            });
            
            timelineInstance.on('mouseOut', function(properties) {
                if (properties.item) {
                    timelineInstance.setItemCSS(properties.item, {
                        'box-shadow': 'none',
                        'transform': 'scale(1)'
                    });
                }
            });
            
        }
    } catch (err) {
        console.error("时间轴渲染出错:", err);
        container.innerHTML = `
            <div class="error-notice">
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <h4>时间轴加载失败</h4>
                        <p>错误: ${err.message}</p>
                        <small>请检查控制台获取更多信息</small>
                    </div>
                </div>
            </div>
        `;
    }
}

// 辅助函数：获取季节顺序
function getSeasonOrder(season) {
    const orderMap = {
        '春': 1,
        '夏': 2,
        '秋': 3,
        '冬': 4,
        '未知': 5
    };
    return orderMap[season] || 5;
}

// 辅助函数：获取季节的具体日期范围
function getSeasonDates(year, season) {
    const yearStr = String(year).padStart(4, '0');
    
    switch(season) {
        case '春':
            return {
                start: `${yearStr}-03-01`,
                end: `${yearStr}-05-31`
            };
        case '夏':
            return {
                start: `${yearStr}-06-01`,
                end: `${yearStr}-08-31`
            };
        case '秋':
            return {
                start: `${yearStr}-09-01`,
                end: `${yearStr}-11-30`
            };
        case '冬':
            return {
                start: `${yearStr}-12-01`,
                end: `${String(year + 1).padStart(4, '0')}-02-28`
            };
        default:
            return {
                start: `${yearStr}-01-01`,
                end: `${yearStr}-12-31`
            };
    }
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

    const filterFunc = () => {
        const query = (searchInput?.value || '').toLowerCase();
        const cat = categorySelect?.value || 'all';
        const filtered = events.filter(e => 
            (e.title.toLowerCase().includes(query) || (e.description || '').toLowerCase().includes(query)) &&
            (cat === 'all' || e.category === cat)
        );
        renderEvents(filtered);
    };

    searchInput?.addEventListener('input', filterFunc);
    categorySelect?.addEventListener('change', filterFunc);
    renderEvents();
}

// --- 全局搜索逻辑 (支持精准跳转) ---
function initSearch() {
    const searchInput = document.getElementById('global-search');
    const searchBtn = document.getElementById('search-btn');
    if(!searchInput || !searchBtn) return;
    
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;
        
        // 汇总搜索库，标记 searchType 用于跳转判断
        const allData =[
            ...characters.map(c => ({...c, searchType: 'character'})),
            ...events.map(e => ({...e, searchType: 'event'})),
            ...timeline.map(t => ({...t, searchType: 'timeline'})),
            ...indexDataCache.items.map(i => ({...i, searchType: 'item'})),
            ...indexDataCache.poems.map(p => ({...p, searchType: 'poem'})),
            ...indexDataCache.festivals.map(f => ({...f, searchType: 'festival'})),
            ...indexDataCache.proverbs.map(v => ({...v, searchType: 'proverb'}))
        ];
        
        const results = allData.filter(item => {
            const title = (item.name || item.title || item.event || item.phrase || '').toLowerCase();
            const desc = (item.description || item.content || '').toLowerCase();
            return title.includes(query) || desc.includes(query);
        });
        
        showSearchResults(results, query);
    }
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
}

function showSearchResults(results, query) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    if(!modal) return;
    
    modalTitle.textContent = `搜索: "${query}" (${results.length}个结果)`;
    
    if (results.length === 0) {
        modalBody.innerHTML = '<p>没有找到相关结果。</p>';
    } else {
        modalBody.innerHTML = `<div class="search-results">${results.slice(0, 20).map(item => `
            <div class="search-result-item" data-id="${item.id}" data-type="${item.searchType}" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee;">
                <h4>${item.name || item.title || item.event || item.phrase || '未命名'}</h4>
                <p><small>类别: ${getTypeLabel(item.searchType)}</small></p>
            </div>`).join('')}</div>`;
        
        modalBody.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                const type = item.getAttribute('data-type');
                
                // 1. 关闭搜索弹窗
                modal.classList.remove('active');

                // 2. 执行跳转逻辑
                executeJump(id, type);
            });
        });
    }
    modal.classList.add('active');
}

// 核心跳转执行函数
function executeJump(id, type) {
    let sectionId = '';
    let tabId = '';

    // 映射板块与索引标签
    switch(type) {
        case 'character': sectionId = 'characters'; break;
        case 'event': sectionId = 'events'; break;
        case 'timeline': sectionId = 'timeline'; break;
        case 'item': sectionId = 'index'; tabId = 'items'; break;
        case 'poem': sectionId = 'index'; tabId = 'poems'; break;
        case 'festival': sectionId = 'index'; tabId = 'festivals'; break;
        case 'proverb': sectionId = 'index'; tabId = 'proverbs'; break;
    }

    if (!sectionId) return;

    // 1. 同步导航栏激活状态
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('href') === `#${sectionId}`);
    });

    // 2. 切换板块
    showSection(sectionId);

    // 3. 进入板块后的具体定位
    setTimeout(() => {
        if (type === 'character') {
            if (currentGraph) currentGraph.focus(id);
        } else if (type === 'event') {
            const e = events.find(ev => ev.id == id);
            if (e) showEventModal(e);
        } else if (type === 'timeline') {
            const t = timeline.find(tl => tl.id == id);
            if (t) showEventModal({title: t.event, description: t.description, year: t.year});
        } else if (sectionId === 'index' && tabId) {
            // 点击对应的标签按钮
            const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
            if (tabBtn) tabBtn.click();
            // 延迟一点显示具体条目详情
            setTimeout(() => showIndexItemDetail(id, tabId), 100);
        }
    }, 300);
}

// --- 索引模块 ---
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

function loadIndexData(type) {
    const grid = document.querySelector(`#${type}-tab .index-grid`);
    if(!grid) return;
    const data = indexDataCache[type] ||[];
    
    grid.innerHTML = data.map(item => {
        let title = item.name || item.title || item.phrase;
        let sub = item.identity || item.author || item.category || item.time || "";
        let groupTag = (type === 'persons' && item.group) ? `<small style="color:#8b0000; display:block;">[${item.group}]</small>` : "";
        return `
            <div class="index-item" onclick="showIndexItemDetail('${item.id}', '${type}')">
                <h4>${title}</h4>
                ${groupTag}
                <p>${sub}</p>
            </div>
        `;
    }).join('');
}

window.showIndexItemDetail = function(itemId, itemType) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const list = indexDataCache[itemType] ||[];
    const item = list.find(d => d.id == itemId);
    if(!item) return;

    modalTitle.textContent = item.name || item.title || item.phrase || "详情";
    let html = "";
    if (itemType === 'persons') {
        html = `<p><strong>籍册：</strong><span style="color:#8b0000;">${item.group || '未入册'}</span></p><p><strong>身份：</strong>${item.identity}</p><p><strong>家族：</strong>${item.family}</p><hr><p>${item.description}</p>`;
    } else if (itemType === 'poems') {
        html = `<p><strong>作者：</strong>${item.author}</p><div style="background:#fdfcf8; padding:15px; border:1px solid #ddd; white-space:pre-wrap; text-align:center; font-family:serif; line-height:2;">${item.content}</div>`;
    } else {
        html = `<p>${item.description || item.meaning || '暂无详细内容'}</p>`;
    }
    
    modalBody.innerHTML = html;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
};

// 辅助函数
function showEventModal(ev) {
    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-title').textContent = ev.title || ev.event || "详情";
    document.getElementById('modal-body').innerHTML = `
        <p><strong>时间：</strong>第${ev.year}年 · ${ev.season || ''} · ${ev.chapter || ''}</p>
        <hr style="margin:10px 0; border:none; border-top:1px solid #eee;">
        <p style="line-height:1.6;">${ev.description || ''}</p>
        ${ev.characters ? `<p style="margin-top:10px;"><small>涉及人物：${ev.characters.join('、')}</small></p>` : ''}
    `;
    modal.classList.add('active');
    modal.querySelector('.close-modal').onclick = () => modal.classList.remove('active');
}

// 补充了获取家族名称的辅助函数 (筛选功能必需)
function getFamilyName(key) { return {jia:'贾',wang:'王',shi:'史',xue:'薛'}[key] || ''; }

function getEventCategoryLabel(c) { return {'family':'家族兴衰','love':'情感主线','fate':'命运转折','social':'社会事件'}[c] || '其他'; }
function getTypeLabel(t) { return {character:'人物',event:'事件',timeline:'时间轴',poem:'诗词',item:'器物',festival:'节日',proverb:'俗语',main:'主要人物',major:'重要人物'}[t] || t; }
function getNodeColor(t) { return {main:'#8b0000',major:'#d4af37',minor:'#2e8b57'}[t] || '#6c757d'; }
function getNodeRadius(t) { return {main:25,major:20,minor:15}[t] || 10; }
function getLinkColor(t) { return {blood:'#dc3545',marriage:'#28a745','master-servant':'#fd7e14',emotional:'#17a2b8',family:'#6f42c1'}[t] || '#999'; }
