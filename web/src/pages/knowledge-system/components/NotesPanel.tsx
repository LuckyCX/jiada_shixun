
import { useState } from 'react';

interface Note {
  id: string;
  content: string;
  timestamp: string;
  tag: 'important' | 'question' | 'idea' | 'normal';
  resourceTitle?: string;
}

interface NotesPanelProps {
  knowledgeName: string;
}

const tagConfig = {
  important: {
    label: '重点',
    color: 'bg-red-100 text-red-600',
    icon: 'ri-star-fill',
  },
  question: {
    label: '疑问',
    color: 'bg-yellow-100 text-yellow-600',
    icon: 'ri-question-line',
  },
  idea: {
    label: '想法',
    color: 'bg-green-100 text-green-600',
    icon: 'ri-lightbulb-line',
  },
  normal: {
    label: '笔记',
    color: 'bg-gray-100 text-gray-600',
    icon: 'ri-edit-line',
  },
};

const mockNotes: Note[] = [
  {
    id: 'n1',
    content:
      '头脑风暴的核心是"延迟判断"，在创意生成阶段绝对不能批评他人想法，这是保证创意数量的关键！',
    timestamp: '10分钟前',
    tag: 'important',
    resourceTitle: '头脑风暴法理论讲解',
  },
  {
    id: 'n2',
    content:
      '书面头脑风暴（Brainwriting）可以解决沉默效应，适合内向型团队成员，值得在实践中尝试。',
    timestamp: '25分钟前',
    tag: 'idea',
    resourceTitle: '头脑风暴实施指南',
  },
  {
    id: 'n3',
    content:
      '从众效应是头脑风暴的大敌，如何在实际操作中避免？可以让每人先独立写5分钟再讨论。',
    timestamp: '1小时前',
    tag: 'question',
    resourceTitle: '头脑风暴实施指南',
  },
];

export default function NotesPanel({ knowledgeName }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTag, setNewNoteTag] = useState<Note['tag']>('normal');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [filterTag, setFilterTag] = useState<Note['tag'] | 'all'>('all');

  /** Helper to safely update notes state */
  const safeSetNotes = (updater: (prev: Note[]) => Note[]) => {
    try {
      setNotes(updater);
    } catch (e) {
      console.error('Failed to update notes:', e);
    }
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    const note: Note = {
      id: `n${Date.now()}`,
      content: newNoteContent.trim(),
      timestamp: '刚刚',
      tag: newNoteTag,
      resourceTitle: knowledgeName,
    };
    safeSetNotes((prev) => [note, ...prev]);
    setNewNoteContent('');
    setNewNoteTag('normal');
    setShowAddNote(false);
  };

  const handleDelete = (id: string) => {
    safeSetNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = (id: string) => {
    if (!editContent.trim()) {
      // Prevent saving empty content
      return;
    }
    safeSetNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, content: editContent.trim(), timestamp: '刚刚' } : n,
      ),
    );
    setEditingId(null);
  };

  const filtered =
    filterTag === 'all' ? notes : notes.filter((n) => n.tag === filterTag);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
      style={{ height: '100%' }}
    >
      {/* 标题栏 */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 flex items-center justify-center bg-amber-50 rounded-lg">
            <i className="ri-sticky-note-line text-amber-500 text-lg"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">我的笔记</h3>
            <p className="text-xs text-gray-400">{notes.length} 条记录</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddNote(!showAddNote)}
          className="w-8 h-8 flex items-center justify-center bg-teal-500 hover:bg-teal-600 text-white rounded-full transition-all shadow-sm"
        >
          <i
            className={`${
              showAddNote ? 'ri-close-line' : 'ri-add-line'
            } text-sm`}
          ></i>
        </button>
      </div>

      {/* 新增笔记区域 */}
      {showAddNote && (
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex-shrink-0">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="记录你的想法、疑问或重点..."
            className="w-full text-sm border border-amber-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
            rows={3}
            maxLength={300}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-2">
              {(Object.keys(tagConfig) as Note['tag'][]).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNewNoteTag(tag)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    newNoteTag === tag
                      ? `${tagConfig[tag].color} ring-2 ring-offset-1 ring-teal-400`
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  <i className={`${tagConfig[tag].icon} mr-1`}></i>
                  {tagConfig[tag].label}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">
                {newNoteContent.length}/300
              </span>
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!newNoteContent.trim()}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 text-white text-xs rounded-lg transition-all whitespace-nowrap"
              >
                保存笔记
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 筛选标签 */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center space-x-2 overflow-x-auto flex-shrink-0">
        <button
          type="button"
          onClick={() => setFilterTag('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
            filterTag === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部 ({notes.length})
        </button>
        {(Object.keys(tagConfig) as Note['tag'][]).map((tag) => {
          const count = notes.filter((n) => n.tag === tag).length;
          if (count === 0) return null;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                filterTag === tag
                  ? `${tagConfig[tag].color} ring-1 ring-current`
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className={`${tagConfig[tag].icon} mr-1`}></i>
              {tagConfig[tag].label} ({count})
            </button>
          );
        })}
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <i className="ri-sticky-note-2-line text-2xl text-gray-400"></i>
            </div>
            <p className="text-sm text-gray-500">暂无笔记</p>
            <p className="text-xs text-gray-400 mt-1">点击右上角 + 开始记录</p>
          </div>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 transition-all group"
            >
              {/* 标签和时间 */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-medium ${tagConfig[note.tag].color}`}
                >
                  <i className={`${tagConfig[note.tag].icon} mr-1`}></i>
                  {tagConfig[note.tag].label}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">{note.timestamp}</span>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleEdit(note)}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-teal-600 transition-colors"
                    >
                      <i className="ri-edit-line text-xs"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note.id)}
                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <i className="ri-delete-bin-line text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* 笔记内容 */}
              {editingId === note.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full text-sm border border-teal-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    rows={3}
                    maxLength={300}
                  />
                  <div className="flex justify-end space-x-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all whitespace-nowrap"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(note.id)}
                      className="px-3 py-1 text-xs bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-all whitespace-nowrap"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
              )}

              {/* 来源 */}
              {note.resourceTitle && (
                <p className="text-xs text-gray-400 mt-2 flex items-center">
                  <i className="ri-links-line mr-1"></i>
                  {note.resourceTitle}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
