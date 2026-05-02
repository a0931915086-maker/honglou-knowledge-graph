// 全局变量
let characters = [];
let relationships = [];
let events = [];
let timeline = [];
let items = [];
let festivals = [];
let poems = [];
let proverbs = [];
let currentGraph = null;
let currentSelectedNode = null;

// 基础路径函数
function getBasePath() {
    const currentPath = window.location.pathname;
    
    // 如果是GitHub Pages
    if (window.location.hostname.includes('github.io')) {
        // 从路径中提取仓库名称
        const pathParts = currentPath.split('/').filter(part => part);
        
        // 如果是用户站点（username.github.io）
        if (pathParts.length === 0 || pathParts[0].includes('.')) {
            return window.location.origin;
        }
        // 如果是项目站点（username.github.io/repo-name）
        else {
            return window.location.origin + '/' + pathParts[0];
        }
    } else {
        // 本地开发
        return window.location.origin;
    }
}

// 数据加载函数
async function fetchData(filename) {
    const basePath = getBasePath();
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // 尝试不同的路径
    const paths = [
        // GitHub Pages路径
        `${basePath}/data/${filename}`,
        // 相对路径
        `data/${filename}`,
        // 根路径
        `/${filename}`,
        // 相对路径2
        `./data/${filename}`
    ];
    
    // 如果是本地开发，优先尝试本地路径
    if (isLocal) {
        paths.unshift(`data/${filename}`);
    }
    
    for (let i = 0; i < paths.length; i++) {
        try {
            console.log(`尝试路径 ${i+1}: ${paths[i]}`);
            const response = await fetch(paths[i]);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`成功从 ${paths[i]} 加载 ${filename}`);
                return data;
            }
        } catch (error) {
            console.log(`路径 ${paths[i]} 失败:`, error.message);
            continue;
        }
    }
    
    throw new Error(`无法加载数据文件: ${filename}`);
}

// 调试信息
function logDebugInfo() {
    console.log('=== 调试信息 ===');
    console.log('当前URL:', window.location.href);
    console.log('主机名:', window.location.hostname);
    console.log('路径:', window.location.pathname);
    console.log('基础路径:', getBasePath());
    console.log('字符数量:', characters.length);
    console.log('关系数量:', relationships.length);
    console.log('=== 结束调试 ===');
}

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('《红楼梦》知识图谱网站正在初始化...');
    
    // 显示加载状态
    showLoadingState();
    
    try {
        // 加载数据
        await loadAllData();
        
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
        
        // 隐藏加载状态
        hideLoadingState();
        
        // 输出调试信息
        logDebugInfo();
        
    } catch (error) {
        console.error('初始化失败:', error);
        showDataLoadError(error.message);
    }
});

// 显示加载状态
function showLoadingState() {
    const homeSection = document.getElementById('home');
    if (homeSection) {
        const statsContainer = homeSection.querySelector('.stats-container');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>正在加载数据...</p>
                </div>
            `;
        }
    }
}

// 隐藏加载状态
function hideLoadingState() {
    const loadingState = document.querySelector('.loading-state');
    if (loadingState) {
        loadingState.remove();
    }
}

// 加载所有数据
async function loadAllData() {
    try {
        // 并行加载所有必要数据
        const dataPromises = [
            fetchData('characters.json').then(data => characters = data),
            fetchData('relationships.json').then(data => relationships = data),
            fetchData('events.json').then(data => events = data)
        ];
        
        // 可选数据
        const optionalDataPromises = [
            fetchData('timeline.json').then(data => timeline = data).catch(() => timeline = []),
            fetchData('items.json').then(data => items = data).catch(() => items = []),
            fetchData('festivals.json').then(data => festivals = data).catch(() => festivals = []),
            fetchData('poems.json').then(data => poems = data).catch(() => poems = []),
            fetchData('proverbs.json').then(data => proverbs = data).catch(() => proverbs = [])
        ];
        
        await Promise.all(dataPromises);
        await Promise.allSettled(optionalDataPromises);
        
        console.log('数据加载完成');
        
    } catch (error) {
        console.error('数据加载失败:', error);
        throw error;
    }
}

// 显示数据加载错误提示
function showDataLoadError(errorMessage) {
    const homeSection = document.getElementById('home');
    if (homeSection) {
        const quickLinks = homeSection.querySelector('.quick-links');
        if (quickLinks) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-notice';
            errorDiv.innerHTML = `
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <h4>数据加载失败</h4>
                        <p>${errorMessage || '无法加载数据文件'}</p>
                        <p><small>请确保data目录下有正确的JSON文件</small></p>
                    </div>
                </div>
            `;
            
            quickLinks.parentNode.insertBefore(errorDiv, quickLinks);
        }
    }
}

// 更新统计数据
function updateStatistics() {
    const charCount = document.getElementById('character-count');
    const relCount = document.getElementById('relationship-count');
    
    if (charCount) charCount.textContent = characters.length;
    if (relCount) relCount.textContent = relationships.length;
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
        
        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            const targetLink = document.querySelector(`.nav-link[href="#${target}"]`);
            if (targetLink) targetLink.classList.add('active');
            
            // 显示对应部分
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

// 时间轴初始化
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container || timeline.length === 0) return;
    
    container.innerHTML = '<p>时间轴功能暂未实现</p>';
}

// 事件页面初始化
function initEvents() {
    const container = document.getElementById('events-container');
    if (!container || events.length === 0) return;
    
    container.innerHTML = events.map(event => `
        <div class="event-card">
            <h3>${event.title}</h3>
            <p>${event.description || '暂无描述'}</p>
        </div>
    `).join('');
}

// 索引初始化
function initIndex() {
    const tabBtns = document.querySelectorAll('.tab-btn');
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
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// 搜索初始化
function initSearch() {
    const searchInput = document.getElementById('global-search');
    const searchBtn = document.getElementById('search-btn');
    
    if (!searchInput || !searchBtn) return;
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        
        alert(`搜索功能暂未实现，搜索词: ${query}`);
    }
}
