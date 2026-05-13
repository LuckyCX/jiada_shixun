import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import VersionControl from '../../components/feature/VersionControl';

interface Version {
  id: number;
  versionNumber: number;
  description: string;
  timestamp: string;
  author: string;
  data: any;
}

export default function ProductDesign() {
  const [activeTab, setActiveTab] = useState<'features' | 'prototype' | 'feedback' | 'code' | 'ui'>('features');
  
  // 版本控制状态 - 功能设计
  const [featuresVersions, setFeaturesVersions] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - 创建功能清单和用户旅程图',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { features: [] }
    }
  ]);
  const [featuresCurrentVersion, setFeaturesCurrentVersion] = useState(1);

  // 版本控制状态 - 代码开发
  const [codeVersionsHistory, setCodeVersionsHistory] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - 代码开发工作台',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { codeVersions: [] }
    }
  ]);
  const [codeCurrentVersion, setCodeCurrentVersion] = useState(1);

  // 版本控制状态 - UI设计
  const [uiVersionsHistory, setUiVersionsHistory] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - UI设计工作台',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { uiVersions: [] }
    }
  ]);
  const [uiCurrentVersion, setUiCurrentVersion] = useState(1);

  const [roleType, setRoleType] = useState<'engineering' | 'design'>('engineering');
  const [codeLanguage, setCodeLanguage] = useState('Python');
  const [codeRequirement, setCodeRequirement] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useExternalLink, setUseExternalLink] = useState(false);
  const [externalLink, setExternalLink] = useState('');
  
  // UI设计相关状态
  const [uiDescription, setUiDescription] = useState('');
  const [generatedUI, setGeneratedUI] = useState<any>(null);
  const [isGeneratingUI, setIsGeneratingUI] = useState(false);
  const [useUpload, setUseUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState('');
  const [countdown, setCountdown] = useState(48 * 60 * 60);
  const [uiVersions, setUiVersions] = useState([
    {
      id: 1,
      title: '登录页面设计',
      description: '蓝白配色，简洁现代风格，包含Logo、表单和社交登录',
      createdAt: '1天前',
      author: '陈雪',
      type: 'generated',
      imageUrl: 'https://readdy.ai/api/search-image?query=modern%20login%20page%20interface%20design%20with%20blue%20and%20white%20color%20scheme%2C%20clean%20minimalist%20UI%20with%20logo%20at%20top%2C%20email%20and%20password%20input%20fields%2C%20social%20media%20login%20buttons%2C%20professional%20web%20design%20mockup%2C%20bright%20background&width=800&height=600&seq=ui-design-001&orientation=landscape'
    },
    {
      id: 2,
      title: '商品详情页设计',
      description: '展示商品图片、价格、描述、评价等信息，绿色主题',
      createdAt: '3天前',
      author: '王芳',
      type: 'uploaded',
      imageUrl: 'https://readdy.ai/api/search-image?query=modern%20product%20detail%20page%20interface%20design%20with%20green%20theme%2C%20clean%20layout%20showing%20product%20images%20gallery%2C%20price%20tag%2C%20description%20text%2C%20customer%20reviews%20section%2C%20add%20to%20cart%20button%2C%20professional%20e-commerce%20UI%20mockup%2C%20bright%20background&width=800&height=600&seq=ui-design-002&orientation=landscape'
    }
  ]);

  const [codeVersions, setCodeVersions] = useState([
    {
      id: 1,
      language: 'Python',
      title: '配送路径优化算法',
      description: '基于A*算法实现的智能路径规划',
      createdAt: '2天前',
      author: '张明',
      code: `import heapq
import math

def calculate_distance(point1, point2):
    """计算两点之间的欧几里得距离"""
    return math.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)

def astar_path_planning(start, goal, obstacles):
    """A*路径规划算法"""
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {start: 0}
    f_score = {start: calculate_distance(start, goal)}
    
    while open_set:
        current = heapq.heappop(open_set)[1]
        
        if current == goal:
            path = []
            while current in came_from:
                path.append(current)
                current = came_from[current]
            path.append(start)
            return path[::-1]
        
        for neighbor in get_neighbors(current, obstacles):
            tentative_g_score = g_score[current] + calculate_distance(current, neighbor)
            
            if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                f_score[neighbor] = tentative_g_score + calculate_distance(neighbor, goal)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))
    
    return None

def get_neighbors(point, obstacles):
    """获取相邻可达点"""
    neighbors = []
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)]
    
    for dx, dy in directions:
        neighbor = (point[0] + dx, point[1] + dy)
        if neighbor not in obstacles:
            neighbors.append(neighbor)
    
    return neighbors`
    },
    {
      id: 2,
      language: 'JavaScript',
      title: '实时位置追踪模块',
      description: 'WebSocket实现的配送员位置实时更新',
      createdAt: '5天前',
      author: '李华',
      code: `class DeliveryTracker {
  constructor(orderId) {
    this.orderId = orderId;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.ws = new WebSocket(\`wss://api.example.com/tracking/\${this.orderId}\`);
    
    this.ws.onopen = () => {
      console.log('WebSocket连接已建立');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.updateDeliveryLocation(data);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      this.handleReconnect();
    };
  }

  updateDeliveryLocation(data) {
    const { latitude, longitude, speed, estimatedTime } = data;
    
    // 更新地图标记
    this.updateMapMarker(latitude, longitude);
    
    // 更新预计送达时间
    this.updateEstimatedTime(estimatedTime);
    
    // 触发UI更新
    this.notifyUI({
      position: { lat: latitude, lng: longitude },
      speed: speed,
      eta: estimatedTime
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(\`尝试重连 (\${this.reconnectAttempts}/\${this.maxReconnectAttempts})\`);
        this.connect();
      }, 3000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}`
    }
  ]);

  const [teamMembers] = useState([
    { id: 1, name: '张明', role: '算法工程师', task: '路径优化算法', status: '进行中', avatar: 'ZM' },
    { id: 2, name: '李华', role: '前端工程师', task: '实时追踪界面', status: '已完成', avatar: 'LH' },
    { id: 3, name: '王芳', role: '后端工程师', task: 'API接口开发', status: '待开始', avatar: 'WF' },
    { id: 4, name: '陈雪', role: 'UI设计师', task: '界面设计', status: '进行中', avatar: 'CX' }
  ]);

  // 版本控制处理函数 - 功能设计
  const handleSaveFeaturesVersion = (description: string) => {
    const newVersion: Version = {
      id: featuresVersions.length + 1,
      versionNumber: featuresVersions.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: {
        features: features
      }
    };
    setFeaturesVersions([...featuresVersions, newVersion]);
    setFeaturesCurrentVersion(newVersion.versionNumber);
  };

  const handleRestoreFeaturesVersion = (versionNumber: number) => {
    const version = featuresVersions.find(v => v.versionNumber === versionNumber);
    if (version) {
      setFeaturesCurrentVersion(versionNumber);
      // 这里可以恢复功能设计的数据
      alert(`已回撤到版本 v${versionNumber}`);
    }
  };

  // 版本控制处理函数 - 代码开发
  const handleSaveCodeVersion = (description: string) => {
    const newVersion: Version = {
      id: codeVersionsHistory.length + 1,
      versionNumber: codeVersionsHistory.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: {
        codeVersions: codeVersions,
        codeLanguage,
        codeRequirement,
        generatedCode,
        externalLink
      }
    };
    setCodeVersionsHistory([...codeVersionsHistory, newVersion]);
    setCodeCurrentVersion(newVersion.versionNumber);
  };

  const handleRestoreCodeVersion = (versionNumber: number) => {
    const version = codeVersionsHistory.find(v => v.versionNumber === versionNumber);
    if (version && version.data) {
      setCodeVersions(version.data.codeVersions || []);
      setCodeLanguage(version.data.codeLanguage || 'Python');
      setCodeRequirement(version.data.codeRequirement || '');
      setGeneratedCode(version.data.generatedCode || '');
      setExternalLink(version.data.externalLink || '');
      setCodeCurrentVersion(versionNumber);
    }
  };

  // 版本控制处理函数 - UI设计
  const handleSaveUIVersion = (description: string) => {
    const newVersion: Version = {
      id: uiVersionsHistory.length + 1,
      versionNumber: uiVersionsHistory.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: {
        uiVersions: uiVersions,
        uiDescription,
        generatedUI,
        uploadedImage
      }
    };
    setUiVersionsHistory([...uiVersionsHistory, newVersion]);
    setUiCurrentVersion(newVersion.versionNumber);
  };

  const handleRestoreUIVersion = (versionNumber: number) => {
    const version = uiVersionsHistory.find(v => v.versionNumber === versionNumber);
    if (version && version.data) {
      setUiVersions(version.data.uiVersions || []);
      setUiDescription(version.data.uiDescription || '');
      setGeneratedUI(version.data.generatedUI || null);
      setUploadedImage(version.data.uploadedImage || '');
      setUiCurrentVersion(versionNumber);
    }
  };

  // 倒计时效果
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}小时 ${minutes}分钟 ${secs}秒`;
  };

  const handleGenerateCode = () => {
    if (!codeRequirement.trim()) {
      alert('请输入需求描述');
      return;
    }

    setIsGenerating(true);
    
    setTimeout(() => {
      const mockCode = `# ${codeRequirement}
# 生成时间: ${new Date().toLocaleString()}
# 语言: ${codeLanguage}

${codeLanguage === 'Python' ? `def optimize_algorithm():
    """
    ${codeRequirement}
    """
    # TODO: 实现算法逻辑
    pass

if __name__ == "__main__":
    result = optimize_algorithm()
    print(f"优化结果: {result}")` : 
codeLanguage === 'JavaScript' ? `/**
 * ${codeRequirement}
 */
function optimizeAlgorithm() {
  // TODO: 实现算法逻辑
  return null;
}

// 调用示例
const result = optimizeAlgorithm();
console.log('优化结果:', result);` :
`// ${codeRequirement}
public class Algorithm {
    public static void main(String[] args) {
        // TODO: 实现算法逻辑
        System.out.println("优化结果:");
    }
}`}`;

      setGeneratedCode(mockCode);
      setIsGenerating(false);
    }, 2000);
  };

  const handleSaveCode = () => {
    if (!generatedCode && !externalLink) {
      alert('请先生成代码或填写外部链接');
      return;
    }

    const newVersion = {
      id: codeVersions.length + 1,
      language: codeLanguage,
      title: codeRequirement.slice(0, 30) + (codeRequirement.length > 30 ? '...' : ''),
      description: codeRequirement,
      createdAt: '刚刚',
      author: '当前用户',
      code: useExternalLink ? `// 外部链接: ${externalLink}` : generatedCode
    };

    setCodeVersions([newVersion, ...codeVersions]);
    setCodeRequirement('');
    setGeneratedCode('');
    setExternalLink('');
    alert('代码已保存到版本记录');
  };

  const handleGenerateUI = () => {
    if (!uiDescription.trim()) {
      alert('请输入页面描述');
      return;
    }

    setIsGeneratingUI(true);

    setTimeout(() => {
      const mockUI = {
        title: uiDescription.slice(0, 30) + (uiDescription.length > 30 ? '...' : ''),
        description: uiDescription,
        layout: generateMockLayout(uiDescription)
      };
      setGeneratedUI(mockUI);
      setIsGeneratingUI(false);
    }, 2500);
  };

  const generateMockLayout = (description: string) => {
    const hasLogin = description.includes('登录') || description.includes('login');
    const hasForm = description.includes('表单') || description.includes('form');
    const hasCard = description.includes('卡片') || description.includes('card');
    
    return {
      hasLogin,
      hasForm,
      hasCard,
      colorScheme: description.includes('蓝') ? 'blue' : description.includes('绿') ? 'green' : description.includes('红') ? 'red' : 'purple'
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('文件大小不能超过5MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUI = () => {
    if (!generatedUI && !uploadedImage) {
      alert('请先生成UI或上传设计稿');
      return;
    }

    const newVersion = {
      id: uiVersions.length + 1,
      title: useUpload ? '上传的设计稿' : (generatedUI?.title || ''),
      description: useUpload ? '手动上传的设计稿' : (generatedUI?.description || ''),
      createdAt: '刚刚',
      author: '当前用户',
      type: useUpload ? 'uploaded' : 'generated',
      imageUrl: uploadedImage || `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28uiDescription%29%7D%2C%20modern%20UI%20design%20mockup%2C%20clean%20interface%2C%20professional%20web%20design%2C%20bright%20background&width=800&height=600&seq=ui-design-${Date.now()}&orientation=landscape`
    };

    setUiVersions([newVersion, ...uiVersions]);
    setUiDescription('');
    setGeneratedUI(null);
    setUploadedImage('');
    alert('设计稿已保存到版本管理');
  };

  const handleDeleteUI = (id: number) => {
    if (confirm('确定要删除这个设计稿吗？')) {
      setUiVersions(uiVersions.filter(v => v.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <img src="https://public.readdy.ai/ai/img_res/a45fb981-255c-43bf-a2cd-2de142ce7a9c.png" alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold text-gray-900">嘉兴大学创业实训平台</span>
            </Link>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-sm text-gray-600">产品设计与原型</span>
          </div>
          <button className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-question-line mr-2"></i>
            AI助手
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">产品设计与原型</h1>
          <p className="text-lg text-gray-600">将用户需求转化为具体的产品方案和可视化原型</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('features')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'features' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-list-check-2 mr-2"></i>
              功能设计
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'code' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-code-s-slash-line mr-2"></i>
              代码开发
              <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">NEW</span>
            </button>
            <button
              onClick={() => setActiveTab('ui')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'ui' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-palette-line mr-2"></i>
              UI设计
              <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs rounded-full">NEW</span>
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'feedback' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-feedback-line mr-2"></i>
              反馈优化
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'features' && (
              <div className="space-y-8">
                {/* 版本控制工具栏 */}
                <VersionControl
                  moduleName="功能设计"
                  currentVersion={featuresCurrentVersion}
                  versions={featuresVersions}
                  onSaveVersion={handleSaveFeaturesVersion}
                  onRestoreVersion={handleRestoreFeaturesVersion}
                />

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-blue-900 mb-3">产品功能设计指南</h3>
                  <ul className="text-sm text-blue-700 space-y-2">
                    <li>• 基于用户画像和调研成果，梳理产品核心功能和次要功能</li>
                    <li>• 明确每个功能的描述、使用场景和目标用户</li>
                    <li>• 确保功能设计贴合用户痛点，解决实际问题</li>
                    <li>• 按优先级排序，先实现核心功能</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">功能清单</h3>
                  <button className="px-5 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-add-line mr-2"></i>
                    添加功能
                  </button>
                </div>

                <div className="space-y-4">
                  {features.map((feature) => (
                    <div key={feature.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-base font-bold text-gray-900">{feature.name}</h4>
                            <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                              feature.priority === '高' ? 'bg-red-100 text-red-700' :
                              feature.priority === '中' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {feature.priority}优先级
                            </span>
                            <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                              feature.status === '已完成' ? 'bg-green-100 text-green-700' :
                              feature.status === '开发中' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {feature.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                          <div className="flex items-start gap-2 text-sm">
                            <i className="ri-lightbulb-line text-blue-500 mt-0.5"></i>
                            <div>
                              <span className="font-medium text-gray-900">使用场景：</span>
                              <span className="text-gray-600">{feature.scenario}</span>
                            </div>
                          </div>
                        </div>
                        <button className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                          <i className="ri-more-2-fill text-lg"></i>
                        </button>
                      </div>
                      <div className="flex gap-2 pt-4 border-t border-gray-100">
                        <button className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer">
                          <i className="ri-edit-line mr-2"></i>
                          编辑
                        </button>
                        <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                          <i className="ri-delete-bin-line mr-2"></i>
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">用户旅程图</h3>
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                        1
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-900 mb-2">发现需求</h4>
                        <p className="text-sm text-gray-600 mb-2">用户感到饥饿，想要点外卖</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <i className="ri-emotion-line"></i>
                          <span>情绪：中性</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                        2
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-900 mb-2">浏览选择</h4>
                        <p className="text-sm text-gray-600 mb-2">打开APP浏览餐厅和菜品，查看评价</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <i className="ri-emotion-happy-line"></i>
                          <span>情绪：期待</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                        3
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-900 mb-2">下单支付</h4>
                        <p className="text-sm text-gray-600 mb-2">选择菜品加入购物车，填写地址，完成支付</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <i className="ri-emotion-normal-line"></i>
                          <span>情绪：平静</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                        4
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-900 mb-2">等待配送</h4>
                        <p className="text-sm text-gray-600 mb-2">实时查看配送进度，等待送达</p>
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <i className="ri-emotion-unhappy-line"></i>
                          <span>痛点：等待时间长，焦虑</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0">
                        5
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-900 mb-2">收货评价</h4>
                        <p className="text-sm text-gray-600 mb-2">收到外卖，用餐后进行评价</p>
                        <div className="flex items-center gap-2 text-xs text-green-500">
                          <i className="ri-emotion-laugh-line"></i>
                          <span>情绪：满意</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              <div className="space-y-6">
                {/* 版本控制工具栏 */}
                <VersionControl
                  moduleName="代码开发"
                  currentVersion={codeCurrentVersion}
                  versions={codeVersionsHistory}
                  onSaveVersion={handleSaveCodeVersion}
                  onRestoreVersion={handleRestoreCodeVersion}
                />

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="ri-code-s-slash-line text-purple-500 mr-2"></i>
                    代码生成智能体工作台
                  </h3>

                  {/* 语言选择 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">选择编程语言</label>
                    <div className="flex gap-3">
                      {['Python', 'JavaScript', 'Java', 'C++', 'Go'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setCodeLanguage(lang)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            codeLanguage === lang
                              ? 'bg-purple-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 需求描述 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">需求描述</label>
                    <textarea
                      value={codeRequirement}
                      onChange={(e) => setCodeRequirement(e.target.value)}
                      placeholder="请详细描述你需要实现的算法或功能，例如：实现一个基于A*算法的配送路径优化系统，需要考虑实时交通状况和配送时间窗口..."
                      className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      maxLength={500}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">详细的需求描述有助于生成更准确的代码</span>
                      <span className="text-xs text-gray-500">{codeRequirement.length}/500</span>
                    </div>
                  </div>

                  {/* 生成按钮 */}
                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={handleGenerateCode}
                      disabled={isGenerating || !codeRequirement.trim()}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <i className="ri-loader-4-line mr-2 animate-spin"></i>
                          AI生成中...
                        </>
                      ) : (
                        <>
                          <i className="ri-sparkling-line mr-2"></i>
                          AI生成代码
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setUseExternalLink(!useExternalLink)}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                        useExternalLink
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <i className="ri-link mr-2"></i>
                      使用外部链接
                    </button>
                  </div>

                  {/* 外部链接输入 */}
                  {useExternalLink && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <label className="block text-sm font-medium text-blue-900 mb-3">
                        <i className="ri-link mr-2"></i>
                        粘贴外部代码链接
                      </label>
                      <input
                        type="url"
                        value={externalLink}
                        onChange={(e) => setExternalLink(e.target.value)}
                        placeholder="例如：https://github.com/username/repo 或 https://codesandbox.io/s/..."
                        className="w-full px-4 py-3 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-blue-600 mt-2">支持 GitHub、CodeSandbox、GitLab 等平台链接</p>
                    </div>
                  )}

                  {/* 代码展示区 */}
                  {generatedCode && !useExternalLink && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">生成的代码</label>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCode);
                            alert('代码已复制到剪贴板');
                          }}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-file-copy-line mr-1"></i>
                          复制代码
                        </button>
                      </div>
                      <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-gray-100 font-mono">
                          <code>{generatedCode}</code>
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* 保存按钮 */}
                  {(generatedCode || externalLink) && (
                    <button
                      onClick={handleSaveCode}
                      className="w-full px-6 py-3 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-save-line mr-2"></i>
                      保存到版本记录
                    </button>
                  )}
                </div>

                {/* 代码版本记录 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="ri-history-line text-purple-500 mr-2"></i>
                    代码版本记录
                  </h3>
                  <div className="space-y-4">
                    {codeVersions.map((version) => (
                      <div key={version.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full whitespace-nowrap">
                                {version.language}
                              </span>
                              <h4 className="text-base font-bold text-gray-900">{version.title}</h4>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{version.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <i className="ri-user-line"></i>
                                {version.author}
                              </span>
                              <span className="flex items-center gap-1">
                                <i className="ri-time-line"></i>
                                {version.createdAt}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-4 mb-3 overflow-x-auto max-h-64">
                          <pre className="text-xs text-gray-100 font-mono">
                            <code>{version.code}</code>
                          </pre>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-4 py-2 bg-purple-50 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap cursor-pointer">
                            <i className="ri-file-copy-line mr-2"></i>
                            复制代码
                          </button>
                          <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                            <i className="ri-download-line mr-2"></i>
                            下载文件
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 多任务分工面板 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="ri-team-line text-purple-500 mr-2"></i>
                    团队任务分工
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {member.avatar}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-base font-bold text-gray-900">{member.name}</h4>
                              <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                                member.status === '已完成' ? 'bg-green-100 text-green-700' :
                                member.status === '进行中' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {member.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{member.role}</p>
                            <div className="flex items-center gap-2 text-sm">
                              <i className="ri-task-line text-purple-500"></i>
                              <span className="text-gray-700">{member.task}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-4 px-6 py-3 bg-purple-50 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-add-line mr-2"></i>
                    分配新任务（队长）
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'ui' && (
              <div className="space-y-6">
                {/* 版本控制工具栏 */}
                <VersionControl
                  moduleName="UI设计"
                  currentVersion={uiCurrentVersion}
                  versions={uiVersionsHistory}
                  onSaveVersion={handleSaveUIVersion}
                  onRestoreVersion={handleRestoreUIVersion}
                />

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="ri-palette-line text-pink-500 mr-2"></i>
                    AI UI设计工作台
                  </h3>

                  {/* 页面描述 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">页面描述</label>
                    <textarea
                      value={uiDescription}
                      onChange={(e) => setUiDescription(e.target.value)}
                      placeholder="请详细描述你需要设计的页面，例如：登录页，蓝白风格，顶部有Logo，中间是邮箱和密码输入框，底部有社交媒体登录按钮..."
                      className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
                      maxLength={500}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">详细的描述有助于生成更符合预期的界面</span>
                      <span className="text-xs text-gray-500">{uiDescription.length}/500</span>
                    </div>
                  </div>

                  {/* 生成/上传切换 */}
                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={handleGenerateUI}
                      disabled={isGeneratingUI || !uiDescription.trim()}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-medium rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      {isGeneratingUI ? (
                        <>
                          <i className="ri-loader-4-line mr-2 animate-spin"></i>
                          AI渲染中...
                        </>
                      ) : (
                        <>
                          <i className="ri-sparkling-line mr-2"></i>
                          AI渲染界面
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setUseUpload(!useUpload)}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                        useUpload
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <i className="ri-upload-line mr-2"></i>
                      上传设计稿
                    </button>
                  </div>

                  {/* 上传区域 */}
                  {useUpload && (
                    <div className="mb-6 p-6 bg-blue-50 border-2 border-dashed border-blue-300 rounded-xl text-center">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="ui-upload"
                      />
                      <label htmlFor="ui-upload" className="cursor-pointer">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <i className="ri-upload-cloud-line text-3xl text-blue-600"></i>
                        </div>
                        <h4 className="text-base font-bold text-gray-900 mb-2">上传设计稿</h4>
                        <p className="text-sm text-gray-600 mb-2">支持 PNG、JPG 格式，最大 5MB</p>
                        <button className="px-6 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap cursor-pointer">
                          选择文件
                        </button>
                      </label>
                      {uploadedImage && (
                        <div className="mt-4">
                          <img src={uploadedImage} alt="Uploaded" className="max-w-full max-h-96 mx-auto rounded-lg shadow-lg" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI生成的UI展示 */}
                  {generatedUI && !useUpload && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">生成的界面预览</label>
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <i className="ri-checkbox-circle-fill"></i>
                          渲染完成
                        </span>
                      </div>
                      <div className="border-2 border-gray-200 rounded-xl p-8 bg-gradient-to-br from-gray-50 to-white">
                        {/* 模拟UI布局 */}
                        <div className={`max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-4 ${
                          generatedUI.layout.colorScheme === 'blue' ? 'border-blue-500' :
                          generatedUI.layout.colorScheme === 'green' ? 'border-green-500' :
                          generatedUI.layout.colorScheme === 'red' ? 'border-red-500' :
                          'border-purple-500'
                        }`}>
                          {/* Header */}
                          <div className={`h-16 ${
                            generatedUI.layout.colorScheme === 'blue' ? 'bg-blue-500' :
                            generatedUI.layout.colorScheme === 'green' ? 'bg-green-500' :
                            generatedUI.layout.colorScheme === 'red' ? 'bg-red-500' :
                            'bg-purple-500'
                          } flex items-center justify-center`}>
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                              <i className="ri-user-line text-xl text-gray-700"></i>
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="p-12">
                            {generatedUI.layout.hasLogin && (
                              <div className="space-y-6">
                                <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">欢迎登录</h2>
                                <div className="space-y-4">
                                  <div className="h-12 bg-gray-100 rounded-lg flex items-center px-4">
                                    <i className="ri-mail-line text-gray-400 mr-3"></i>
                                    <span className="text-sm text-gray-400">邮箱地址</span>
                                  </div>
                                  <div className="h-12 bg-gray-100 rounded-lg flex items-center px-4">
                                    <i className="ri-lock-line text-gray-400 mr-3"></i>
                                    <span className="text-sm text-gray-400">密码</span>
                                  </div>
                                  <button className={`w-full h-12 ${
                                    generatedUI.layout.colorScheme === 'blue' ? 'bg-blue-500' :
                                    generatedUI.layout.colorScheme === 'green' ? 'bg-green-500' :
                                    generatedUI.layout.colorScheme === 'red' ? 'bg-red-500' :
                                    'bg-purple-500'
                                  } text-white rounded-lg font-medium`}>
                                    登录
                                  </button>
                                </div>
                                <div className="flex items-center gap-4 mt-8">
                                  <div className="flex-1 h-px bg-gray-200"></div>
                                  <span className="flex items-center gap-1">
                                    <i className="ri-wechat-fill"></i>
                                    <i className="ri-github-fill"></i>
                                    <i className="ri-google-fill"></i>
                                  </span>
                                  <div className="flex-1 h-px bg-gray-200"></div>
                                </div>
                              </div>
                            )}
                            
                            {generatedUI.layout.hasCard && !generatedUI.layout.hasLogin && (
                              <div className="grid grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                  <div key={i} className="bg-gray-100 rounded-xl p-6">
                                    <div className="w-full h-32 bg-gray-200 rounded-lg mb-4"></div>
                                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {generatedUI.layout.hasForm && !generatedUI.layout.hasLogin && (
                              <div className="space-y-4">
                                <div className="h-12 bg-gray-100 rounded-lg"></div>
                                <div className="h-12 bg-gray-100 rounded-lg"></div>
                                <div className="h-24 bg-gray-100 rounded-lg"></div>
                                <button className={`w-full h-12 ${
                                  generatedUI.layout.colorScheme === 'blue' ? 'bg-blue-500' :
                                  generatedUI.layout.colorScheme === 'green' ? 'bg-green-500' :
                                  generatedUI.layout.colorScheme === 'red' ? 'bg-red-500' :
                                  'bg-purple-500'
                                } text-white rounded-lg font-medium`}>
                                  提交
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-center text-sm text-gray-500 mt-6">
                          <i className="ri-information-line mr-1"></i>
                          这是AI生成的模拟界面预览，实际效果可能有所不同
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 保存按钮 */}
                  {(generatedUI || uploadedImage) && (
                    <button
                      onClick={handleSaveUI}
                      className="w-full px-6 py-3 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-save-line mr-2"></i>
                      保存到版本管理
                    </button>
                  )}
                </div>

                {/* 设计稿版本管理 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="ri-gallery-line text-pink-500 mr-2"></i>
                    设ign稿版本管理
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    {uiVersions.map((version) => (
                      <div key={version.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all">
                        <div className="relative">
                          <img 
                            src={version.imageUrl} 
                            alt={version.title}
                            className="w-full h-64 object-cover"
                          />
                          <span className={`absolute top-3 right-3 px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            version.type === 'generated' 
                              ? 'bg-pink-500 text-white' 
                              : 'bg-blue-500 text-white'
                          }`}>
                            {version.type === 'generated' ? 'AI生成' : '手动上传'}
                          </span>
                        </div>
                        <div className="p-5">
                          <h4 className="text-base font-bold text-gray-900 mb-2">{version.title}</h4>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{version.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                            <span className="flex items-center gap-1">
                              <i className="ri-user-line"></i>
                              {version.author}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ri-time-line"></i>
                              {version.createdAt}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button className="flex-1 px-4 py-2 bg-pink-50 text-pink-600 text-sm font-medium rounded-lg hover:bg-pink-100 transition-colors whitespace-nowrap cursor-pointer">
                              <i className="ri-eye-line mr-2"></i>
                              预览
                            </button>
                            <button 
                              onClick={() => handleDeleteUI(version.id)}
                              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 团队任务分工 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    <i className="ri-team-line text-pink-500 mr-2"></i>
                    团队任务分工
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {member.avatar}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-base font-bold text-gray-900">{member.name}</h4>
                              <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                                member.status === '已完成' ? 'bg-green-100 text-green-700' :
                                member.status === '进行中' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {member.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{member.role}</p>
                            <div className="flex items-center gap-2 text-sm">
                              <i className="ri-task-line text-pink-500"></i>
                              <span className="text-gray-700">{member.task}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-4 px-6 py-3 bg-pink-50 text-pink-600 text-sm font-medium rounded-lg hover:bg-pink-100 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-add-line mr-2"></i>
                    分配新任务（队长）
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'feedback' && (
              <div className="space-y-8">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-blue-900 mb-3">教师反馈与优化</h3>
                  <p className="text-sm text-blue-700">查看教师的审核意见和优化建议，根据反馈完善产品设计</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white border-l-4 border-green-500 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <i className="ri-check-line text-green-600 text-lg"></i>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900 mb-1">首页原型设计已通过</h4>
                          <p className="text-xs text-gray-500">王老师 · 2天前</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                        已通过
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      整体设计思路清晰，功能布局合理。信息架构符合用户使用习惯，视觉设计简洁美观。建议在下一版本中增加个性化推荐算法的说明。
                    </p>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap cursor-pointer">
                        查看详情
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border-l-4 border-amber-500 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                          <i className="ri-error-warning-line text-amber-600 text-lg"></i>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900 mb-1">订单追踪页面需要修改</h4>
                          <p className="text-xs text-gray-500">王老师 · 3天前</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full whitespace-nowrap">
                        待修改
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      地图交互设计不错，但建议优化以下几点：
                    </p>
                    <ul className="text-sm text-gray-700 space-y-2 mb-4 ml-4">
                      <li>• 配送员头像和信息展示位置可以更突出</li>
                      <li>• 预计送达时间的计算逻辑需要说明</li>
                      <li>• 增加异常情况的处理流程（如配送延迟）</li>
                      <li>• 联系按钮的交互反馈需要优化</li>
                    </ul>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-amber-50 text-amber-600 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap cursor-pointer">
                        开始修改
                      </button>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                        查看批注
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border-l-4 border-blue-500 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="ri-lightbulb-line text-blue-600 text-lg"></i>
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-gray-900 mb-1">功能设计优化建议</h4>
                          <p className="text-xs text-gray-500">王老师 · 1周前</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full whitespace-nowrap">
                        建议
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      整体功能规划完善，建议考虑以下补充功能：
                    </p>
                    <ul className="text-sm text-gray-700 space-y-2 mb-4 ml-4">
                      <li>• 增加用户积分和会员体系设计</li>
                      <li>• 考虑社交分享功能，提升用户粘性</li>
                      <li>• 设计配送员激励机制</li>
                      <li>• 增加数据统计和分析功能</li>
                    </ul>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer">
                        采纳建议
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">修改记录</h3>
                  <div className="space-y-3">
                    {[
                      { version: 'v2.0', date: '2天前', changes: '根据教师反馈优化首页布局，增加个性化推荐说明' },
                      { version: 'v1.5', date: '5天前', changes: '完善订单追踪页面交互逻辑，优化地图显示' },
                      { version: 'v1.0', date: '1周前', changes: '初版原型设计完成，包含核心功能页面' }
                    ].map((record, index) => (
                      <div key={index} className="flex items-start gap-4 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                          {record.version}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">版本 {record.version}</span>
                            <span className="text-xs text-gray-500">{record.date}</span>
                          </div>
                          <p className="text-sm text-gray-600">{record.changes}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock data for features tab
const features = [
  {
    id: 1,
    name: '智能推荐系统',
    description: '基于用户历史订单和偏好，智能推荐餐厅和菜品',
    priority: '高',
    status: '开发中',
    scenario: '用户打开APP首页时，系统自动展示个性化推荐内容'
  },
  {
    id: 2,
    name: '实时配送追踪',
    description: '用户可以实时查看配送员位置和预计送达时间',
    priority: '高',
    status: '已完成',
    scenario: '用户下单后，可以在订单详情页查看配送进度'
  },
  {
    id: 3,
    name: '优惠券系统',
    description: '支持多种优惠券类型，包括满减、折扣、新人券等',
    priority: '中',
    status: '规划中',
    scenario: '用户在结算时可以选择使用优惠券抵扣订单金额'
  }
];
