// 全局变量
let characters = [];
let relationships = [];
let events = [];
let timeline = [];
let currentGraph = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 加载数据
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
        
        updateStatistics();
        initNavigation();
        initHomePage();
        
        // 容错隔离
        try { initTimeline(); } catch(e) { console.error('时间轴初始化失败:', e); }
        try { initEvents(); } catch(e) { console.error('事件初始化失败:', e); }
        try { initIndex(); } catch(e) { console.error('索引初始化失败:', e); }
        try { initSearch(); } catch(e) { console.error('搜索初始化失败:', e); }
        
        // 初始显示首页
        showSection('home');
    }).catch(error => {
        console.error('加载数据失败:', error);
    });
});

// 数据加载
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
    const charCount = document.getElementById('character-count');
    const relCount = document.getElementById('relationship-count');
    if(charCount) charCount.textContent = characters.length;
    if(relCount) relCount.textContent = relationships.length;
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

// 核心修复：显示 Section 时的逻辑
function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // 如果进入人物图谱且图表未初始化，则初始化
        if (sectionId === 'characters') {
            if (!currentGraph) {
                initCharacterGraph();
            } else {
                // 如果已初始化，重启力导向模拟以防位置错乱
                currentGraph.simulation.alpha(0.3).restart();
            }
        }
    }
}

function initHomePage() {
    document.querySelectorAll('.link-card').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            const navLink = document.querySelector(`.nav-link[href="#${target}"]`);
            if(navLink) navLink.click();
        });
    });
}

// 人物关系图谱初始化修复
function initCharacterGraph() {
    const container = document.getElementById('relationship-graph');
    if (!container || characters.length === 0) return;

    // 清空现有内容（防止重复初始化）
    container.innerHTML = '';

    // 核心修复：获取实际可见后的尺寸
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const svg = d3.select('#relationship-graph')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    // 缩放功能
    svg.call(d3.zoom().on('zoom', (event) => {
        g.attr('transform', event.transform);
    }));

    // 箭头定义
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .append('path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('fill', '#999');

    // 数据转换
    const nodes = characters.map(d => ({ ...d }));
    const links = relationships.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(40));

    const link = g.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', d => getRelationColor(d.type))
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)');

    const node = g.append('g')
        .selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('click', (event, d) => showCharacterDetail(d));

    node.append('circle')
        .attr('r', 20)
        .attr('fill', d => getNodeColor(d.type))
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

    node.append('text')
        .text(d => d.name)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '12px')
        .attr('fill', '#333');

    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x; d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
    }

    // 过滤逻辑修复
    const applyFilters = () => {
        const relType = document.getElementById('relation-filter').value;
        const familyType = document.getElementById('family-filter').value;

        node.style('display', d => {
            const matchFamily = (familyType === 'all' || d.family === getFamilyName(familyType));
            return matchFamily ? 'block' : 'none';
        });

        link.style('display', d => {
            const matchRel = (relType === 'all' || d.type === relType);
            const sourceNode = nodes.find(n => n.id === (d.source.id || d.source));
            const targetNode = nodes.find(n => n.id === (d.target.id || d.target));
            
            // 只有当两个端点都显示且关系类型匹配时才显示
            const bothNodesVisible = (familyType === 'all' || 
                (sourceNode.family === getFamilyName(familyType) && targetNode.family === getFamilyName(familyType)));
            
            return (matchRel && bothNodesVisible) ? 'block' : 'none';
        });
    };

    document.getElementById('relation-filter').addEventListener('change', applyFilters);
    document.getElementById('family-filter').addEventListener('change', applyFilters);
    document.getElementById('reset-view').addEventListener('click', () => {
        svg.transition().duration(750).call(d3.zoom().transform, d3.zoomIdentity);
        document.getElementById('relation-filter').value = 'all';
        document.getElementById('family-filter').value = 'all';
        applyFilters();
    });

    currentGraph = { simulation };
}

// 辅助：获取家族对应名称
function getFamilyName(key) {
    const map = { 'jia': '贾家', 'wang': '王家', 'shi': '史家', 'xue': '薛家' };
    return map[key] || key;
}

function getNodeColor(type) {
    return { 'main': '#8b0000', 'major': '#d4af37', 'minor': '#2e8b57' }[type] || '#6c757d';
}

function getRelationColor(type) {
    return { 'blood': '#dc3545', 'marriage': '#28a745', 'emotional': '#17a2b8' }[type] || '#999';
}

// 详情显示
function showCharacterDetail(character) {
    const detailPanel = document.getElementById('character-detail');
    detailPanel.innerHTML = `
        <div class="character-detail-info">
            <h3 style="color:#8b0000; border-bottom:2px solid #8b0000; padding-bottom:5px;">${character.name}</h3>
            <p><strong>家族：</strong>${character.family}</p>
            <p><strong>身份：</strong>${character.identity}</p>
            <p style="margin-top:10px; color:#666; line-height:1.6;">${character.description}</p>
        </div>
    `;
}

// 时间轴修复
function initTimeline() {
    const container = document.getElementById('timeline-container');
    if(!container || timeline.length === 0) return;

    const items = new vis.DataSet(timeline.map(item => ({
        id: item.id,
        content: item.event,
        start: `00${item.year}-01-01`, // 修复年份格式
        className: item.type
    })));

    const options = {
        min: '0001-01-01',
        max: '0020-01-01',
        start: '0001-01-01',
        end: '0015-01-01',
        editable: false,
        zoomMin: 1000 * 60 * 60 * 24 * 30
    };

    new vis.Timeline(container, items, options);
}

// 其他初始化函数（initEvents, initIndex 等）...
// 建议保持你原有的逻辑，但确保在 fetchData 成功后调用
