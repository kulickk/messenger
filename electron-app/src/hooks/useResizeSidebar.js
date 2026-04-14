import { useEffect, useRef, useState } from "react";

export function useResizeSidebar() {
    const [isResizing, setIsResizing] = useState(false);
    const resizebleNavigation = useRef();
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    const handleMouseDown = (e) => {
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = resizebleNavigation.current.offsetWidth;
    };

    const handleMouseUp = () => {
        setIsResizing(false);
    };

    const handleMouseMove = (e) => {   
        if (!isResizing) return;
        
        const dx = e.clientX - startXRef.current;
        let newWidth = startWidthRef.current + dx;
        resizebleNavigation.current.style.width = `${newWidth}px`;
    };

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
        };
    });

    return [resizebleNavigation, handleMouseDown];
}