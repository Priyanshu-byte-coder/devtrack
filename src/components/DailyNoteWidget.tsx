"use client";

import { useCallback, useEffect, useState } from "react";

export default function DailyNoteWidget(){

  const [loading,setLoading] = useState(false);
  const [note,setNote] = useState("");
  const [yesterdayNote, setYesterdayNote] = useState("");
  const [showYesterday,setShowYesterday] = useState(false);

  useEffect(()=>{
    
    const fetchNotes = async ()=>{

      try{
        setLoading(true);

        const response = await fetch("/api/daily-note");

        const data = await response.json();
        setNote(data.todayNote||"");
        setYesterdayNote(data.yesterdayNote ||"" );
      
      }catch(error){
        console.error("Failed to fetch notes");
      }finally{
        setLoading(false);
      }
      
    };
    fetchNotes();
  },[]);


// auto save with debounce
// Wrapped in useCallback so the function reference is stable across renders.
// Without this, the auto-save useEffect would capture a stale closure of
// debounceFunction on any re-render that isn't caused by `note` changing,
// silently saving the wrong value or skipping the save entirely.
const debounceFunction = useCallback(async () => {
  if (!note.trim()) return;

  try {
    await fetch("/api/daily-note", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note,
      }),
    });
  } catch (error) {
    console.error("Failed to save note");
  }
}, [note]);

useEffect(() => {
  const timeout = setTimeout(() => {
    debounceFunction();
  }, 500);
  return () => clearTimeout(timeout);
}, [note, debounceFunction]);


if (loading) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="h-5 w-40 bg-[var(--card-muted)] rounded animate-pulse mb-4" />
      <div className="space-y-2">
        <div className="h-4 bg-[var(--card-muted)] rounded animate-pulse w-3/4" />
        <div className="h-4 bg-[var(--card-muted)] rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
} 

  return(

    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="m-3 w-40  rounded mb-4 ml-0" >
          <h2 className="text-lg font-semibold text-[var(--card-foreground)] ">
            Today&apos;s Plan
          </h2>
          
          <p className="text-sm text-[var(--muted-foreground)]">Plan your coding session.</p>
      </div>
        <div className="space-y-2">
         
         
        <textarea value={note}
        onChange={(e)=>{
          if(e.target.value.length <= 280){
            setNote(e.target.value);
          }
        }} 
        onBlur={debounceFunction}
        placeholder="What will you code today?" 
        rows={3}
        className=" w-full resize-none rounded-md border border-gray-300 p-2
        focus:outline-none transition focus:border-gray-500" 
        />

        <div className="mt-2 flex items-center justify-between">

          <p className="text-xs text-gray-400">
            Auto-saves automatically
         </p>
         <p className="text-xs text-gray-500">
            {note.length}/280
        </p>
        </div>

        <div className="mt-4 rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500 cursor-pointer" onClick={()=> setShowYesterday((prev)=> !prev)} aria-expanded={showYesterday} >
            Yesterday you planned to:
          </p>
          {showYesterday && 
            <p className="mt-1 text-sm text-gray-700">
            {yesterdayNote || "No plan from yesterday"}
          </p>
          }
          
        </div>
        </div>
      </div>
  )
}