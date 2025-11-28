import React, { useEffect, useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../shadcn/resizable';

interface ResizableContentProps {
  Content: React.ReactElement | null;
  AgentSidebar: React.ReactElement | null;
  open?: boolean;
}

export function ResizableContent(props: ResizableContentProps) {
  const { Content, AgentSidebar, open: initialOpen = false } = props;
  const [isOpen, setIsOpen] = useState(initialOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModKeyPressed = isMac ? event.metaKey : event.ctrlKey;

      if (isModKeyPressed && event.key === 'l') {
        const target = event.target as HTMLElement;
        const isInputFocused =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable;

        if (!isInputFocused) {
          event.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setIsOpen(initialOpen);
  }, [initialOpen]);

  const sidebarSize = isOpen ? 50 : 0;
  const contentSize = isOpen ? 50 : 100;

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full overflow-hidden">
      <ResizablePanel defaultSize={contentSize} minSize={isOpen ? 50 : 100} className="h-full overflow-hidden flex flex-col min-h-0">
        <div className="h-full w-full overflow-hidden min-h-0">
        {Content}
        </div>
      </ResizablePanel>
      {isOpen && <ResizableHandle withHandle />}
      {isOpen && (
        <ResizablePanel defaultSize={sidebarSize} minSize={10} maxSize={80} className="h-full overflow-hidden min-w-[320px] flex flex-col min-h-0">
          <div className="h-full w-full overflow-hidden min-h-0">
          {AgentSidebar}
          </div>
        </ResizablePanel>
      )}
    </ResizablePanelGroup>
  );
}
