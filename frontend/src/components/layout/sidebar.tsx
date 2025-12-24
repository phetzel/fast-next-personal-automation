"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import {
  LayoutDashboard,
  MessageSquare,
  Workflow,
  Briefcase,
  ChevronDown,
  ChevronRight,
  LayoutList,
  UserCircle,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { useSidebarStore } from "@/stores";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui";

// Types for navigation structure
interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavArea {
  id: string;
  name: string;
  icon: LucideIcon;
  children: NavItem[];
}

// General navigation items
const generalNavigation: NavItem[] = [
  { name: "Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: "Chat", href: ROUTES.CHAT, icon: MessageSquare },
  { name: "Pipelines", href: ROUTES.PIPELINES, icon: Workflow },
];

// Area-based navigation with sub-routes
const areaNavigation: NavArea[] = [
  {
    id: "jobs",
    name: "Jobs",
    icon: Briefcase,
    children: [
      { name: "Overview", href: ROUTES.JOBS, icon: LayoutDashboard },
      { name: "Listings", href: ROUTES.JOBS_LIST, icon: LayoutList },
      { name: "Profiles", href: ROUTES.JOBS_PROFILES, icon: UserCircle },
      { name: "Pipelines", href: ROUTES.JOBS_PIPELINES, icon: Workflow },
      { name: "Assistant", href: ROUTES.JOBS_ASSISTANT, icon: Bot },
    ],
  },
];

function NavLink({
  item,
  isActive,
  onNavigate,
  indented = false,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
  indented?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        "min-h-[40px]",
        indented && "ml-4 pl-4",
        isActive
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
      )}
    >
      <item.icon className={cn("h-4 w-4", indented && "h-4 w-4")} />
      {item.name}
    </Link>
  );
}

function AreaSection({
  area,
  onNavigate,
}: {
  area: NavArea;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { isAreaCollapsed, toggleArea } = useSidebarStore();

  const isCollapsed = isAreaCollapsed(area.id);

  // Check if any child route is active
  const isAreaActive = area.children.some((child) => pathname === child.href);
  // Check if we're in the area (for highlighting parent when on child route)
  const isInArea = pathname.startsWith(area.children[0]?.href?.split("/").slice(0, 2).join("/") || "");

  return (
    <div className="space-y-0.5">
      {/* Area header button */}
      <button
        onClick={() => toggleArea(area.id)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "min-h-[40px]",
          isInArea
            ? "text-foreground"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
        )}
      >
        <span className="flex items-center gap-3">
          <area.icon className="h-4 w-4" />
          {area.name}
        </span>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Child navigation */}
      {!isCollapsed && (
        <div className="space-y-0.5">
          {area.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              isActive={pathname === child.href}
              onNavigate={onNavigate}
              indented
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Separator() {
  return <div className="mx-3 my-3 border-t border-border/60" />;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 p-3">
      {/* General navigation */}
      {generalNavigation.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          isActive={pathname === item.href}
          onNavigate={onNavigate}
        />
      ))}

      {/* Separator between general and area navigation */}
      <Separator />

      {/* Area navigation */}
      <div className="space-y-1">
        <span className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          Areas
        </span>
        {areaNavigation.map((area) => (
          <AreaSection key={area.id} area={area} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 font-semibold"
          onClick={onNavigate}
        >
          <span>{"personal_automations"}</span>
        </Link>
      </div>
      <NavLinks onNavigate={onNavigate} />
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close } = useSidebarStore();

  return (
    <>
      <aside className="bg-background hidden w-64 shrink-0 border-r md:block">
        <SidebarContent />
      </aside>

      <Sheet open={isOpen} onOpenChange={close}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-14 px-4">
            <SheetTitle>{"personal_automations"}</SheetTitle>
            <SheetClose onClick={close} />
          </SheetHeader>
          <NavLinks onNavigate={close} />
        </SheetContent>
      </Sheet>
    </>
  );
}
