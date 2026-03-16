// 《红楼梦》知识图谱 - JavaScript主逻辑
// 已修复GitHub Pages部署路径问题

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

// 检测GitHub Pages环境
function isGitHubPages() {
    // 检查是否为GitHub Pages域名
    return window.location.hostname.includes('github.io');
}

// 获取正确的数据路径（根据仓库结构优化）
function getDataPath(filename) {
    // 获取当前页面路径信息
    const currentPath = window.location.pathname;
    
    // 如果是GitHub Pages项目站点（如：username.github.io/repo-name/）
    if (isGitHubPages()) {
        // 从路径中提取仓库名称
        const pathParts = currentPath.split('/').filter(part => part);
        
        // 如果是用户/组织站点（如：username.github.io/），仓库名为空
        if (pathParts.length === 0) {
            // 直接使用根路径
            return `/data/${filename}`;
        } else {
            // 项目站点，使用仓库名作为基础路径
            const repoName = pathParts[0];
            return `/${repoName}/data/${filename}`;
        }
    } else {
        // 本地开发环境，使用相对路径
        return `data/${filename}`;
    }
}

// 数据加载函数（简化版本）
async function fetchData(filename) {
    const path = getDataPath(filename);
    
    console.log(`尝试加载数据: ${path}`);
    
    try {
        const response = await fetch(path);
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`成功加载: ${filename}`, data.length ? `(${data.length}条数据)` : '');
        return data;
    } catch (error) {
        console.error(`加载数据文件失败: ${filename}`, error);
        throw new Error(`无法加载数据文件: ${filename}`);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('《红楼梦》知识图谱网站正在初始化...');
    console.log('当前URL:', window.location.href);
    console.log('GitHub Pages环境:', isGitHubPages());
    
    // 显示加载状态
    showLoadingState();
    
    // 加载数据
    loadAllData();
    
    // 初始化事件监听器
    initEventListeners();
    
    // 显示首页
    showSection('home');
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
                    <p><small>当前路径: ${getDataPath('characters.json')}</small></p>
                </div>
            `;
        }
    }
}

// 加载所有数据
async function loadAllData() {
    try {
        // 定义要加载的数据文件
        const dataFiles = [
            { key: 'characters', file: 'characters.json' },
            { key: 'relationships', file: 'relationships.json' },
            { key: 'events', file: 'events.json' },
            { key: 'timeline', file: 'timeline.json' },
            { key: 'items', file: 'items.json' },
            { key: 'festivals', file: 'festivals.json' },
            { key: 'poems', file: 'poems.json' },
            { key: 'proverbs', file: 'proverbs.json' }
        ];
        
        // 依次加载所有数据文件（避免并行加载可能的问题）
        for (const item of dataFiles) {
            try {
                const data = await fetchData(item.file);
                window[item.key] = data;
                console.log(`✓ 已加载 ${item.file}`);
            } catch (error) {
                console.warn(`✗ 加载 ${item.file} 失败，使用空数组`, error);
                window[item.key] = [];
            }
        }
        
        console.log('数据加载完成:');
        console.log('- 人物:', characters.length);
        console.log('- 关系:', relationships.length);
        console.log('- 事件:', events.length);
        console.log('- 时间线:', timeline.length);
        
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
        
    } catch (error) {
        console.error('数据加载过程中发生错误:', error);
        showDataLoadError(error.message);
    }
}

// 隐藏加载状态
function hideLoadingState() {
    const loadingStates = document.querySelectorAll('.loading-state');
    loadingStates.forEach(state => {
        state.style.display = 'none';
    });
}

// 显示数据加载错误提示
function showDataLoadError(errorMessage) {
    const homeSection = document.getElementById('home');
    if (homeSection) {
        // 创建错误提示
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notice';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <h4>数据加载失败</h4>
                    <p>${errorMessage}</p>
                    <p><small>请检查以下内容：</small></p>
                    <ul>
                        <li>data目录是否存在？</li>
                        <li>JSON文件是否正确上传？</li>
                        <li>文件路径是否正确？</li>
                    </ul>
                    <p><small>当前使用路径: ${getDataPath('characters.json')}</small></p>
                </div>
            </div>
        `;
        
        // 插入到页面中
        const hero = homeSection.querySelector('.hero');
        if (hero && hero.nextSibling) {
            homeSection.insertBefore(errorDiv, hero.nextSibling);
        } else {
            homeSection.appendChild(errorDiv);
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
            
            // 如果是图谱页面，重新计算布局
            if (target === 'characters' && currentGraph) {
                setTimeout(() => {
                    if (currentGraph.centerGraph) {
                        currentGraph.centerGraph();
                    }
                }, 100);
            }
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
    if (!graphContainer) return;
    
    const width = graphContainer.offsetWidth;
    const height = graphContainer.offsetHeight || 600;
    
    // 清空容器
    graphContainer.innerHTML = '';
    
    // 如果没有人物数据，显示提示
    if (characters.length === 0) {
        graphContainer.innerHTML = `
            <div class="graph-empty">
                <i class="fas fa-users-slash"></i>
                <p>暂无人物数据</p>
                <p><small>请检查data/characters.json文件是否存在</small></p>
            </div>
        `;
        return;
    }
    
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
        description: char.description,
        family: char.family,
        identity: char.identity,
        status: char.status
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
        .attr('stroke-width', 2)
        .style('cursor', 'pointer');
    
    // 添加点击事件
    node.on('click', (event, d) => {
        showCharacterDetail(d);
    });
    
    // 更新力模拟
    simulation.nodes(nodes).on('tick', ticked);
    simulation.force('link').links(links);
    
    // 工具函数
    function ticked() {
        link.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
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
            'emotional': '#17a2b8',
            'family': '#6f42c1'
        };
        return colors[type] || '#6c757d';
    }
    
    function showCharacterDetail(character) {
        const detailPanel = document.getElementById('character-detail');
        if (!detailPanel) return;
        
        detailPanel.innerHTML = `
            <div class="character-detail">
                <div class="character-header">
                    <h3>${character.name}</h3>
                    <span class="character-type">${getTypeLabel(character.type)}</span>
                </div>
                <p class="character-desc">${character.description || '暂无详细描述'}</p>
            </div>
        `;
        
        currentSelectedNode = character;
    }
    
    // 保存图实例
    currentGraph = {
        svg,
        simulation,
        centerGraph: () => {
            svgGroup.transition().duration(750)
                .attr('transform', 'translate(0,0) scale(1)');
        }
    };
}

// 时间轴初始化
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return;
    
    // 清空容器
    container.innerHTML = '';
    
    // 如果没有时间线数据，显示提示
    if (timeline.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <i class="fas fa-clock"></i>
                <p>暂无时间线数据</p>
            </div>
        `;
        return;
    }
    
    // 显示简单的时间线
    const timelineHTML = timeline.map(item => `
        <div class="timeline-item">
            <div class="timeline-year">第${item.year}年</div>
            <div class="timeline-content">
                <h4>${item.event}</h4>
                <p>${item.description || ''}</p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `
        <div class="timeline-simple">
            ${timelineHTML}
        </div>
    `;
}

// 事件页面初始化
function initEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;
    
    // 渲染事件卡片
    function renderEvents() {
        if (events.length === 0) {
            container.innerHTML = `
                <div class="events-empty">
                    <i class="fas fa-calendar-times"></i>
                    <p>暂无事件数据</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = events.map(event => `
            <div class="event-card">
                <h3>${event.title}</h3>
                <p>${event.description.substring(0, 100)}...</p>
            </div>
        `).join('');
    }
    
    // 初始渲染
    renderEvents();
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
            
            // 加载数据
            loadIndexData(tabId);
        });
    });
    
    // 加载初始数据
    loadIndexData('persons');
}

// 加载索引数据
function loadIndexData(type) {
    const container = document.querySelector(`#${type}-tab .index-grid`);
    if (!container) return;
    
    let data = [];
    
    switch(type) {
        case 'persons':
            data = characters;
            break;
        case 'items':
            data = items;
            break;
        case 'festivals':
            data = festivals;
            break;
        case 'poems':
            data = poems;
            break;
        case 'proverbs':
            data = proverbs;
            break;
    }
    
    if (data.length === 0) {
        container.innerHTML = `
            <div class="index-empty">
                <i class="fas fa-database"></i>
                <p>暂无${getTypeLabel(type)}数据</p>
            </div>
        `;
        return;
    }
    
    // 简单显示数据
    const indexHTML = data.slice(0, 20).map(item => `
        <div class="index-item">
            <h4>${item.name || item.title || item.phrase || '未命名'}</h4>
            <p>${(item.description || item.content || item.meaning || '').substring(0, 50)}...</p>
        </div>
    `).join('');
    
    container.innerHTML = indexHTML;
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
}

// 执行搜索
function performSearch() {
    const query = document.getElementById('global-search').value.trim();
    if (!query) return;
    
    // 简单显示搜索结果
    const results = [...characters, ...events]
        .filter(item => 
            (item.name && item.name.includes(query)) ||
            (item.title && item.title.includes(query)) ||
            (item.description && item.description.includes(query))
        );
    
    alert(`找到 ${results.length} 个结果`);
}

// 初始化所有事件监听器
function initEventListeners() {
    // 模态框关闭事件
    const modal = document.getElementById('detail-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                modal.classList.remove('active');
            }
        });
    }
    
    // 过滤器事件（简化）
    const filters = document.querySelectorAll('select');
    filters.forEach(filter => {
        filter.addEventListener('change', () => {
            console.log(`过滤器更新: ${filter.id} = ${filter.value}`);
        });
    });
}

// 辅助函数
function getTypeLabel(type) {
    const labels = {
        'character': '人物',
        'main': '主要人物',
        'major': '重要人物',
        'minor': '次要人物'
    };
    return labels[type] || type;
}

// 添加CSS样式（简化版本）
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        /* 简单样式补充 */
        .graph-empty, .timeline-empty, .events-empty, .index-empty, .loading-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }
        
        .graph-empty i, .timeline-empty i, .events-empty i, .index-empty i, .loading-state i {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: #8b0000;
        }
        
        .error-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
        }
        
        .error-content {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
        }
        
        .error-content i {
            color: #e67e22;
            font-size: 1.5rem;
            margin-top: 0.2rem;
        }
        
        .error-content h4 {
            color: #d35400;
            margin-bottom: 0.5rem;
        }
        
        .error-content p {
            color: #7d6608;
            margin-bottom: 0.5rem;
        }
        
        .error-content ul {
            margin-left: 1rem;
            color: #7d6608;
        }
        
        .event-card {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 1rem;
        }
        
        .index-item {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 0.5rem;
        }
        
        .timeline-item {
            border-left: 3px solid #8b0000;
            padding-left: 1rem;
            margin-bottom: 1rem;
        }
        
        .timeline-year {
            font-weight: bold;
            color: #8b0000;
        }
    `;
    document.head.appendChild(style);
});
