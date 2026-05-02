// 配置模块
const Config = {
    // 数据文件名 - 请确保 data 文件夹下有此文件
    dataFile: 'characters.json', 
    
    // 节点样式配置
    nodeStyle: {
        normal: { fill: '#3498db', stroke: '#2980b9', radius: 20 },
        highlight: { fill: '#e74c3c', stroke: '#c0392b', radius: 25 }
    },
    
    // 连线样式配置
    linkStyle: {
        normal: { stroke: '#95a5a6', width: 2 },
        highlight: { stroke: '#e74c3c', width: 4 }
    }
};

// 全局变量
let graphData = { nodes: [], links: [] };
let svg, simulation;

// 1. 路径修复核心：动态获取 Base URL
function getBaseUrl() {
    const isLocal = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
        return './'; // 本地环境
    } else {
        // GitHub Pages 环境
        // 逻辑：如果路径包含 github.io，则提取仓库名作为基础路径
        const pathParts = window.location.pathname.split('/');
        // 通常在 gh-pages 分支下，路径结构为 /仓库名/...
        if (pathParts[1] && pathParts[1].includes('.github.io')) {
             // 用户页或项目页的特殊处理
             return `/${pathParts[1]}/`;
        }
        // 默认回退
        return '/';
    }
}

// 初始化时计算基础路径
const BASE_PATH = getBaseUrl();

// 2. 数据加载模块
async function loadData() {
    // 构造正确的 data 路径
    const dataUrl = `${BASE_PATH}data/${Config.dataFile}`;
    
    console.log(`[Path] 正在尝试加载数据: ${dataUrl}`);
    
    try {
        const response = await fetch(dataUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status} - 请检查 ${dataUrl} 是否存在`);
        }
        
        graphData = await response.json();
        console.log('[Data] 数据加载成功:', graphData);
        initGraph();
    } catch (error) {
        showError(`无法加载数据文件，请检查控制台(F12)查看详细路径。
错误详情: ${error.message}`);
        console.error('加载数据失败:', error);
    }
}

// 3. 图谱渲染模块
function initGraph() {
    const container = d3.select('#graph-container');
    const width = container.node().getBoundingClientRect().width;
    const height = window.innerHeight - 60;

    // 创建 SVG
    svg = d3.select('#graph-svg')
        .attr('width', width)
        .attr('height', height);

    // 创建力导向模拟
    simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(150))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));

    // 绘制连线
    const link = svg.append('g')
        .selectAll('line')
        .data(graphData.links)
        .enter().append('line')
        .attr('class', 'link')
        .attr('stroke', Config.linkStyle.normal.stroke)
        .attr('stroke-width', Config.linkStyle.normal.width);

    // 绘制节点
    const node = container.selectAll('.node-group')
        .data(graphData.nodes)
        .enter().append('g')
        .attr('class', 'node-group')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // 节点圆形背景
    node.append('circle')
        .attr('r', Config.nodeStyle.normal.radius)
        .attr('fill', Config.nodeStyle.normal.fill)
        .attr('stroke', Config.nodeStyle.normal.stroke);

    // 节点文字
    node.append('text')
        .text(d => d.name)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none');

    // 鼠标交互事件
    node.on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut);

    // 更新节点位置
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

// 4. 交互逻辑
function handleMouseOver(event, d) {
    // 高亮当前节点
    d3.select(this).select('circle')
        .transition().duration(200)
        .attr('r', Config.nodeStyle.highlight.radius)
        .attr('fill', Config.nodeStyle.highlight.fill);
        
    // 高亮相连节点
    const connectedNodeIds = new Set();
    graphData.links.forEach(link => {
        if (link.source.id === d.id) connectedNodeIds.add(link.target.id);
        if (link.target.id === d.id) connectedNodeIds.add(link.source.id);
    });
    
    svg.selectAll('.node-group').each(function(node) {
        if (connectedNodeIds.has(node.id) || node.id === d.id) {
            d3.select(this).select('circle').attr('opacity', 1);
        } else {
            d3.select(this).select('circle').attr('opacity', 0.2);
        }
    });
}

function handleMouseOut(event, d) {
    // 恢复样式
    svg.selectAll('.node-group circle')
        .transition().duration(200)
        .attr('r', Config.nodeStyle.normal.radius)
        .attr('fill', Config.nodeStyle.normal.fill)
        .attr('opacity', 1);
}

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

// 5. 错误处理与启动
function showError(message) {
    const container = document.getElementById('graph-container');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 50px; color: red;">
                <h3>⚠️ 图谱加载失败</h3>
                ${message}
                请检查 data 文件夹是否已正确提交到 GitHub 仓库中。
            </div>
        `;
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', loadData);
