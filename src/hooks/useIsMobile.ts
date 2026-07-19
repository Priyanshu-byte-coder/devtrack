import { useEffect,useState } from "react";

export function useIsMobile(){

  const [isMobile, setIsMobile] = useState(false);

  useEffect(()=>{
    const handleResize = ()=>{
      setIsMobile(window.innerWidth <769);
    };

    handleResize();

    window.addEventListener("resize",handleResize);

    return ()=>
    window.removeEventListener("resize", handleResize);
  },[]);

  return isMobile;
}