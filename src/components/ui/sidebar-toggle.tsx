"use client";

import { useLayoutEffect, useState } from "react";
import { Icon } from "./icons";

const STORAGE_KEY = "markinsight.sidebar";

function readMode(): "collapsed" | "expanded" {
  if (typeof document === "undefined") return "collapsed";
  const current = document.documentElement.getAttribute("data-sidebar");
  return current === "expanded" ? "expanded" : "collapsed";
}

function applyMode(mode: "collapsed" | "expanded", persist: boolean) {
  document.documentElement.setAttribute("data-sidebar", mode);
  if (persist) localStorage.setItem(STORAGE_KEY, mode);
}

export function SidebarToggle({
  expandLabel,
  collapseLabel,
}: {
  expandLabel: string;
  collapseLabel: string;
}) {
  const [collapsed, setCollapsed] = useState(true);

  useLayoutEffect(() => {
    const sync = () => setCollapsed(readMode() !== "expanded");
    sync();

    const mq = window.matchMedia("(max-width: 1399px)");
    const onResize = () => {
      if (localStorage.getItem(STORAGE_KEY)) return;
      applyMode(mq.matches ? "collapsed" : "expanded", false);
      sync();
    };
    mq.addEventListener("change", onResize);
    return () => mq.removeEventListener("change", onResize);
  }, []);

  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <button
      type="button"
      className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-primary-softer)]"
      aria-label={label}
      title={label}
      aria-expanded={!collapsed}
      onClick={() => {
        const next = collapsed ? "expanded" : "collapsed";
        applyMode(next, true);
        setCollapsed(next === "collapsed");
      }}
    >
      <Icon.Sidebar size={18} className={collapsed ? undefined : "-scale-x-100"} />
    </button>
  );
}
