"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { CommunityRichEditor } from "@/components/community/community-rich-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth-client";

type Section = {
  id: string;
  slug: string;
  title: string;
  section_type: string;
  body_md: string;
  body_html: string;
  summary: string;
  status: "draft" | "published";
  is_visible: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
};

type TeamMember = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  avatar_url: string | null;
  bio: string;
  display_order: number;
  active: boolean;
};

type Publication = {
  enabled: boolean;
  start_at: string | null;
  end_at: string | null;
  duration_minutes?: number | null;
  override_public_window: boolean;
};

type VersionRow = {
  id: string;
  version_no: number;
  snapshot_kind: string;
  created_at: string;
};

const SECTION_TYPES = ["pitch", "technical", "live_matrix", "architecture", "data_flow", "team", "changelog", "custom"];

function htmlToMdFallback(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function DocsAdminClient() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [publication, setPublication] = useState<Publication>({
    enabled: false,
    start_at: null,
    end_at: null,
    duration_minutes: null,
    override_public_window: false,
  });
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId],
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [publicationRes, sectionsRes, teamRes] = await Promise.all([
        fetch("/api/admin/docs/publication", { credentials: "include", cache: "no-store" }),
        fetch("/api/admin/docs/sections", { credentials: "include", cache: "no-store" }),
        fetch("/api/admin/docs/team", { credentials: "include", cache: "no-store" }),
      ]);
      const publicationJson = (await publicationRes.json()) as { publication?: Publication; message?: string };
      const sectionsJson = (await sectionsRes.json()) as { sections?: Section[]; message?: string };
      const teamJson = (await teamRes.json()) as { team?: TeamMember[]; message?: string };
      if (!publicationRes.ok) throw new Error(publicationJson.message ?? "Could not load publication settings.");
      if (!sectionsRes.ok) throw new Error(sectionsJson.message ?? "Could not load sections.");
      if (!teamRes.ok) throw new Error(teamJson.message ?? "Could not load team members.");
      const loadedSections = sectionsJson.sections ?? [];
      setPublication(
        publicationJson.publication ?? {
          enabled: false,
          start_at: null,
          end_at: null,
          duration_minutes: null,
          override_public_window: false,
        },
      );
      setSections(loadedSections);
      setTeam(teamJson.team ?? []);
      setSelectedSectionId((prev) => prev ?? loadedSections[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load admin docs.");
    } finally {
      setLoading(false);
    }
  }

  async function loadVersions(sectionId: string) {
    try {
      const res = await fetch(`/api/admin/docs/sections/versions?sectionId=${sectionId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { versions?: VersionRow[]; message?: string };
      if (!res.ok) throw new Error(json.message ?? "Could not load versions.");
      setVersions(json.versions ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load versions.");
      setVersions([]);
    }
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadAll();
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!selectedSectionId) return;
    const handle = window.setTimeout(() => {
      void loadVersions(selectedSectionId);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [selectedSectionId]);

  async function savePublication() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/docs/publication", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: publication.enabled,
          startAt: publication.start_at,
          endAt: publication.end_at,
          durationMinutes: publication.duration_minutes ?? null,
          overridePublicWindow: publication.override_public_window,
        }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Could not save publication settings.");
      toast.success("Publication settings updated.");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save publication settings.");
    } finally {
      setSaving(false);
    }
  }

  async function createSection() {
    setSaving(true);
    try {
      const slugBase = `section-${Date.now()}`;
      const res = await fetch("/api/admin/docs/sections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugBase,
          title: "New section",
          sectionType: "technical",
          bodyMd: "",
          bodyHtml: "<p></p>",
          summary: "",
          status: "draft",
          isVisible: true,
          sortOrder: sections.length * 10 + 10,
          metadata: { anchors: [slugBase] },
        }),
      });
      const json = (await res.json()) as { section?: Section; message?: string };
      if (!res.ok || !json.section) throw new Error(json.message ?? "Could not create section.");
      setSections((prev) => [...prev, json.section!].sort((a, b) => a.sort_order - b.sort_order));
      setSelectedSectionId(json.section.id);
      toast.success("Section created.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create section.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(snapshotKind: "save" | "publish", status?: "draft" | "published") {
    if (!selectedSection) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/docs/sections", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSection.id,
          slug: selectedSection.slug,
          title: selectedSection.title,
          sectionType: selectedSection.section_type,
          bodyMd: selectedSection.body_md || htmlToMdFallback(selectedSection.body_html),
          bodyHtml: selectedSection.body_html,
          summary: selectedSection.summary,
          sortOrder: selectedSection.sort_order,
          status: status ?? selectedSection.status,
          isVisible: selectedSection.is_visible,
          metadata: selectedSection.metadata,
          snapshotKind,
        }),
      });
      const json = (await res.json()) as { section?: Section; message?: string };
      if (!res.ok || !json.section) throw new Error(json.message ?? "Could not save section.");
      setSections((prev) => prev.map((s) => (s.id === json.section!.id ? json.section! : s)));
      toast.success(snapshotKind === "publish" ? "Section published." : "Draft saved.");
      await loadVersions(selectedSection.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save section.");
    } finally {
      setSaving(false);
    }
  }

  async function reorderSections(nextIds: string[]) {
    const res = await fetch("/api/admin/docs/sections/reorder", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: nextIds }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(json.message ?? "Could not reorder sections.");
    await loadAll();
  }

  async function moveSection(direction: "up" | "down") {
    if (!selectedSection) return;
    const ordered = [...sections].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((s) => s.id === selectedSection.id);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= ordered.length) return;
    [ordered[idx], ordered[target]] = [ordered[target]!, ordered[idx]!];
    try {
      await reorderSections(ordered.map((s) => s.id));
      toast.success("Section order updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder sections.");
    }
  }

  async function publishAll() {
    setPublishingAll(true);
    try {
      const res = await fetch("/api/admin/docs/publish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { message?: string; publishedCount?: number };
      if (!res.ok) throw new Error(json.message ?? "Could not publish docs.");
      toast.success(`Published ${json.publishedCount ?? 0} sections.`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish docs.");
    } finally {
      setPublishingAll(false);
    }
  }

  async function restoreVersion(versionId: string) {
    if (!selectedSection) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/docs/sections/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: selectedSection.id, versionId }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Could not restore version.");
      toast.success("Section restored.");
      await loadAll();
      await loadVersions(selectedSection.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore version.");
    } finally {
      setSaving(false);
    }
  }

  async function addTeamMember() {
    setSaving(true);
    try {
      const email = `member${Date.now()}@example.com`;
      const res = await fetch("/api/admin/docs/team", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "New member",
          role: "Contributor",
          email,
          bio: "",
          active: true,
          displayOrder: team.length * 10 + 10,
        }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Could not add team member.");
      await loadAll();
      toast.success("Team member added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add team member.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTeamMember(member: TeamMember) {
    const res = await fetch("/api/admin/docs/team", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: member.id,
        fullName: member.full_name,
        role: member.role,
        email: member.email,
        avatarUrl: member.avatar_url,
        bio: member.bio,
        active: member.active,
        displayOrder: member.display_order,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) throw new Error(json.message ?? "Could not update team member.");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Live docs editor</h1>
          <p className="text-sm text-muted-foreground">
            Manage publication window, section content, version history, and team cards.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/admin/docs/export/markdown" target="_blank" rel="noreferrer">
              Export markdown
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/admin/docs/export/pdf" target="_blank" rel="noreferrer">
              Export PDF
            </a>
          </Button>
          <Button disabled={publishingAll} onClick={() => void publishAll()}>
            {publishingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Publish snapshot
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="publication">Publication</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="publication">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Public visibility</p>
                <p className="text-sm text-muted-foreground">Toggle docs availability and schedule windows.</p>
              </div>
              <Switch
                checked={publication.enabled}
                onCheckedChange={(next) => setPublication((prev) => ({ ...prev, enabled: next }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start at</Label>
                <Input
                  type="datetime-local"
                  value={publication.start_at ? publication.start_at.slice(0, 16) : ""}
                  onChange={(e) =>
                    setPublication((prev) => ({
                      ...prev,
                      start_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End at</Label>
                <Input
                  type="datetime-local"
                  value={publication.end_at ? publication.end_at.slice(0, 16) : ""}
                  onChange={(e) =>
                    setPublication((prev) => ({
                      ...prev,
                      end_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
              <div>
                <p className="font-medium">Admin override</p>
                <p className="text-xs text-muted-foreground">Force docs public even outside schedule window.</p>
              </div>
              <Switch
                checked={publication.override_public_window}
                onCheckedChange={(next) => setPublication((prev) => ({ ...prev, override_public_window: next }))}
              />
            </div>
            <Button disabled={saving} onClick={() => void savePublication()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save publication settings
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_260px]">
            <Card className="space-y-3 p-3">
              <Button size="sm" className="w-full" onClick={() => void createSection()}>
                <Plus className="mr-2 h-4 w-4" /> Add section
              </Button>
              <div className="space-y-1">
                {sections
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((section) => (
                    <button
                      type="button"
                      key={section.id}
                      onClick={() => setSelectedSectionId(section.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        selectedSectionId === section.id
                          ? "border-primary bg-primary/10"
                          : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <p className="truncate text-sm font-medium">{section.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {section.slug} • {section.status}
                      </p>
                    </button>
                  ))}
              </div>
            </Card>

            <Card className="space-y-4 p-4">
              {!selectedSection ? (
                <p className="text-sm text-muted-foreground">Select a section to edit.</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={selectedSection.title}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((section) =>
                              section.id === selectedSection.id ? { ...section, title: e.target.value } : section,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input
                        value={selectedSection.slug}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((section) =>
                              section.id === selectedSection.id ? { ...section, slug: e.target.value } : section,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Section type</Label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedSection.section_type}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((section) =>
                              section.id === selectedSection.id
                                ? { ...section, section_type: e.target.value }
                                : section,
                            ),
                          )
                        }
                      >
                        {SECTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-3 pb-1">
                      <Button variant="outline" onClick={() => void moveSection("up")}>
                        Move up
                      </Button>
                      <Button variant="outline" onClick={() => void moveSection("down")}>
                        Move down
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Summary</Label>
                    <Textarea
                      value={selectedSection.summary}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((section) =>
                            section.id === selectedSection.id ? { ...section, summary: e.target.value } : section,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Body (WYSIWYG)</Label>
                    <CommunityRichEditor
                      userId={user?.id ?? "admin"}
                      content={selectedSection.body_html}
                      onChange={(nextHtml) =>
                        setSections((prev) =>
                          prev.map((section) =>
                            section.id === selectedSection.id
                              ? { ...section, body_html: nextHtml, body_md: htmlToMdFallback(nextHtml) }
                              : section,
                          ),
                        )
                      }
                      placeholder="Write section content here..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={saving} onClick={() => void saveSection("save", "draft")}>
                      Save draft
                    </Button>
                    <Button disabled={saving} onClick={() => void saveSection("publish", "published")}>
                      Publish section
                    </Button>
                  </div>
                </>
              )}
            </Card>

            <Card className="space-y-3 p-3">
              <p className="text-sm font-medium">Version history</p>
              <div className="space-y-2">
                {versions.map((version) => (
                  <div key={version.id} className="rounded-lg border border-border/60 p-2">
                    <p className="text-xs font-medium">
                      v{version.version_no} • {version.snapshot_kind}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(version.created_at).toLocaleString()}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 px-2 text-xs"
                      onClick={() => void restoreVersion(version.id)}
                    >
                      Restore
                    </Button>
                  </div>
                ))}
                {versions.length === 0 ? <p className="text-xs text-muted-foreground">No versions yet.</p> : null}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Team section cards</p>
              <Button size="sm" onClick={() => void addTeamMember()}>
                <Plus className="mr-2 h-4 w-4" /> Add member
              </Button>
            </div>
            <div className="space-y-3">
              {team
                .slice()
                .sort((a, b) => a.display_order - b.display_order)
                .map((member) => (
                  <div key={member.id} className="rounded-xl border border-border/60 p-3">
                    <div className="grid gap-3 md:grid-cols-4">
                      <Input
                        value={member.full_name}
                        onChange={(e) =>
                          setTeam((prev) =>
                            prev.map((row) => (row.id === member.id ? { ...row, full_name: e.target.value } : row)),
                          )
                        }
                        placeholder="Full name"
                      />
                      <Input
                        value={member.role}
                        onChange={(e) =>
                          setTeam((prev) =>
                            prev.map((row) => (row.id === member.id ? { ...row, role: e.target.value } : row)),
                          )
                        }
                        placeholder="Role"
                      />
                      <Input
                        value={member.email}
                        onChange={(e) =>
                          setTeam((prev) =>
                            prev.map((row) => (row.id === member.id ? { ...row, email: e.target.value } : row)),
                          )
                        }
                        placeholder="Email"
                      />
                      <Input
                        value={member.avatar_url ?? ""}
                        onChange={(e) =>
                          setTeam((prev) =>
                            prev.map((row) =>
                              row.id === member.id ? { ...row, avatar_url: e.target.value || null } : row,
                            ),
                          )
                        }
                        placeholder="Avatar URL"
                      />
                    </div>
                    <Textarea
                      className="mt-2"
                      value={member.bio}
                      onChange={(e) =>
                        setTeam((prev) =>
                          prev.map((row) => (row.id === member.id ? { ...row, bio: e.target.value } : row)),
                        )
                      }
                      placeholder="Short bio"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Visible</span>
                        <Switch
                          checked={member.active}
                          onCheckedChange={(next) =>
                            setTeam((prev) =>
                              prev.map((row) => (row.id === member.id ? { ...row, active: next } : row)),
                            )
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await updateTeamMember(member);
                            toast.success("Team member saved.");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Could not save team member.");
                          }
                        }}
                      >
                        Save member
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

