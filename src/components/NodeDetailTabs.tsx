import { FileText, History, MessageSquare, type LucideIcon } from 'lucide-react';

export type NodeDetailTab = 'summary' | 'history' | 'chat';

interface NodeDetailTabsProps {
  activeTab: NodeDetailTab;
  onChange: (tab: NodeDetailTab) => void;
}

const tabs: Array<{ id: NodeDetailTab; label: string; tone: string; Icon: LucideIcon }> = [
  { id: 'summary', label: 'Summary', tone: 'summary', Icon: FileText },
  { id: 'history', label: 'Rounds', tone: 'history', Icon: History },
  { id: 'chat', label: 'Interview', tone: 'chat', Icon: MessageSquare },
];

export default function NodeDetailTabs({ activeTab, onChange }: NodeDetailTabsProps) {
  return (
    <div className="node-report-tabs" role="tablist" aria-label="Node report sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`node-report-tab node-report-tab--${tab.tone} ${activeTab === tab.id ? 'node-report-tab--active' : ''}`}
        >
          <tab.Icon size={15} />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
