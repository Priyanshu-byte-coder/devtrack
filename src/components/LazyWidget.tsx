"use client";

import {ReactNode,useEffect,useRef,useState,memo} from "react";

interface LazyWidgetProps {
    children: ReactNode;
    fallback: ReactNode;
    rootMargin?: string;
    threshold?: number;
    className?: string;
}

function LazyWidget({
    children,
    fallback,
    rootMargin = "300px",
    threshold = 0.1,
    className = "",
}: LazyWidgetProps) {

    const containerRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const [isVisible , setIsVisible] = useState(false);

    useEffect(()=>{
        const node = containerRef.current;
        if(!node || isVisible) return;

        observerRef.current = new IntersectionObserver(([entry])=>{
            if(entry.isIntersecting){
                setIsVisible(true);

                if(observerRef.current){
                    observerRef.current.disconnect();
                    observerRef.current = null;
                }
            }
        },{
            root : null,
            rootMargin,
            threshold
        });

        observerRef.current.observe(node);

        return ()=>{
            if(observerRef.current){
                observerRef.current.disconnect();
                observerRef.current = null;
            }
        };
    },[isVisible,rootMargin,threshold]);

     return (
        <div ref={containerRef}
        className={className}
        aria-busy={!isVisible}
        aria-live="polite">

        {isVisible ? children : fallback}
        </div>
     );
}

export default memo(LazyWidget);