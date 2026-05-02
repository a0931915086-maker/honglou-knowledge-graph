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
