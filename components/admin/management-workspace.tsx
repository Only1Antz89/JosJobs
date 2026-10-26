"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Shield,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { AdminDataTable } from "@/components/admin/data-table";
import { InsightCard } from "@/components/admin/insight-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { adminRequest } from "@/lib/admin/request";
import { generateId, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { AssignmentSummary, ClientDetail, OperatorDetail } from "@/types/admin";

type EntityScope = "both" | "clients" | "operators";
type DraftMode = "create-client" | "create-operator" | "edit-client" | "edit-operator" | null;

type ClientDraft = {
  companyName: string;
  tradingName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  billingContactName: string;
  billingContactEmail: string;
  billingContactPhone: string;
  status: ClientDetail["status"];
  onboardingStatus: ClientDetail["onboardingStatus"];
  address: string;
  notes: string;
};

type OperatorDraft = {
  displayName: string;
  email: string;
  regions: string;
  skillTags: string;
  verificationStatus: OperatorDetail["verificationStatus"];
  onboardingStatus: OperatorDetail["onboardingStatus"];
  notes: string;
};

type ManagementRecord =
  | {
      key: string;
      kind: "client";
      id: string;
      name: string;
      email: string;
      searchText: string;
      detailHref: string;
      primaryStatus: string;
      secondaryStatus: string;
      revenueEarned: number;
      eventCount: number;
      bookedHours: number;
      expectedValue: number;
      nextActivityAt?: string;
      client: ClientDetail;
    }
  | {
      key: string;
      kind: "operator";
      id: string;
      name: string;
      email: string;
      searchText: string;
      detailHref: string;
      primaryStatus: string;
      secondaryStatus: string;
      revenueEarned: number;
      eventCount: number;
      bookedHours: number;
      expectedValue: number;
      nextActivityAt?: string;
      operator: OperatorDetail;
    };

const EMPTY_CLIENT_DRAFT: ClientDraft = {
  companyName: "",
  tradingName: "",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  billingContactName: "",
  billingContactEmail: "",
  billingContactPhone: "",
  status: "active",
  onboardingStatus: "pending",
  address: "",
  notes: ""
};

const EMPTY_OPERATOR_DRAFT: OperatorDraft = {
  displayName: "",
  email: "",
  regions: "",
  skillTags: "",
  verificationStatus: "pending",
  onboardingStatus: "pending",
  notes: ""
};

function assignmentHours(assignment: AssignmentSummary) {
  return Math.max(
    (new Date(assignment.endsAt).getTime() - new Date(assignment.startsAt).getTime()) /
      (1000 * 60 * 60),
    0
  );
}

function isFutureAssignment(assignment: AssignmentSummary) {
  return new Date(assignment.startsAt).getTime() > Date.now();
}

function toSentenceList(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toTagList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildClientDraft(client: ClientDetail): ClientDraft {
  return {
    companyName: client.companyName,
    tradingName: client.tradingName ?? "",
    primaryContactName: client.primaryContactName,
    primaryContactEmail: client.primaryContactEmail,
    primaryContactPhone: client.primaryContactPhone,
    billingContactName: client.billingContactName,
    billingContactEmail: client.billingContactEmail,
    billingContactPhone: client.billingContactPhone,
    status: client.status,
    onboardingStatus: client.onboardingStatus,
    address: client.address,
    notes: client.notes.join("\n")
  };
}

function buildOperatorDraft(operator: OperatorDetail): OperatorDraft {
  return {
    displayName: operator.displayName,
    email: operator.email,
    regions: operator.regions.join(", "),
    skillTags: operator.skillTags.join(", "),
    verificationStatus: operator.verificationStatus,
    onboardingStatus: operator.onboardingStatus,
    notes: operator.notes.join("\n")
  };
}

function buildManagementRecords(clients: ClientDetail[], operators: OperatorDetail[]): ManagementRecord[] {
  const clientRecords: ManagementRecord[] = clients.map((client) => {
    const futureAssignments = client.assignments.filter(isFutureAssignment);
    const bookedHours = futureAssignments.reduce((sum, assignment) => sum + assignmentHours(assignment), 0);
    const expectedValue = futureAssignments.reduce(
      (sum, assignment) => sum + assignment.totalChargeAmount,
      0
    );

    return {
      key: `client:${client.id}`,
      kind: "client",
      id: client.id,
      name: client.companyName,
      email: client.primaryContactEmail,
      searchText: [
        client.companyName,
        client.tradingName,
        client.primaryContactName,
        client.primaryContactEmail,
        client.billingContactEmail,
        client.address,
        ...client.notes
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      detailHref: `/admin/clients/${client.id}`,
      primaryStatus: client.status,
      secondaryStatus: client.onboardingStatus,
      revenueEarned: client.lifetimeSpend,
      eventCount: client.assignments.length,
      bookedHours,
      expectedValue,
      nextActivityAt: client.lastActivityAt,
      client
    };
  });

  const operatorRecords: ManagementRecord[] = operators.map((operator) => {
    const futureAssignments = operator.assignments.filter(isFutureAssignment);
    const bookedHours = futureAssignments.reduce((sum, assignment) => sum + assignmentHours(assignment), 0);
    const expectedValue = futureAssignments.reduce((sum, assignment) => sum + assignment.totalPayAmount, 0);

    return {
      key: `operator:${operator.id}`,
      kind: "operator",
      id: operator.id,
      name: operator.displayName,
      email: operator.email,
      searchText: [
        operator.displayName,
        operator.email,
        operator.regions.join(" "),
        operator.skillTags.join(" "),
        ...operator.notes
      ]
        .join(" ")
        .toLowerCase(),
      detailHref: `/admin/operators/${operator.id}`,
      primaryStatus: operator.isActive ? "active" : "inactive",
      secondaryStatus: operator.verificationStatus,
      revenueEarned: operator.earningsYtd,
      eventCount: operator.assignments.length,
      bookedHours,
      expectedValue,
      nextActivityAt: operator.latestAssignmentAt,
      operator
    };
  });

  return [...clientRecords, ...operatorRecords].sort((left, right) => right.revenueEarned - left.revenueEarned);
}

function getSelectedRecord(records: ManagementRecord[], selectedKey: string | null) {
  if (!selectedKey) {
    return records[0] ?? null;
  }

  return records.find((record) => record.key === selectedKey) ?? records[0] ?? null;
}

export function AdminManagementWorkspace({
  initialClients,
  initialOperators,
  live = false
}: {
  initialClients: ClientDetail[];
  initialOperators: OperatorDetail[];
  // Live mode saves every change to the database; demo mode keeps changes in this browser session.
  live?: boolean;
}) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [operators, setOperators] = useState(initialOperators);
  const [saving, setSaving] = useState(false);

  // Pick up fresh server data after router.refresh().
  useEffect(() => setClients(initialClients), [initialClients]);
  useEffect(() => setOperators(initialOperators), [initialOperators]);
  const [scope, setScope] = useState<EntityScope>("both");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draftMode, setDraftMode] = useState<DraftMode>(null);
  const [clientDraft, setClientDraft] = useState<ClientDraft>(EMPTY_CLIENT_DRAFT);
  const [operatorDraft, setOperatorDraft] = useState<OperatorDraft>(EMPTY_OPERATOR_DRAFT);

  const managementRecords = useMemo(
    () => buildManagementRecords(clients, operators),
    [clients, operators]
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return managementRecords.filter((record) => {
      if (scope === "clients" && record.kind !== "client") {
        return false;
      }

      if (scope === "operators" && record.kind !== "operator") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return record.searchText.includes(normalizedSearch);
    });
  }, [managementRecords, scope, search]);

  useEffect(() => {
    if (filteredRecords.length === 0) {
      setSelectedKey(null);
      return;
    }

    if (!selectedKey || !filteredRecords.some((record) => record.key === selectedKey)) {
      setSelectedKey(filteredRecords[0].key);
    }
  }, [filteredRecords, selectedKey]);

  const selectedRecord = useMemo(
    () => getSelectedRecord(filteredRecords, selectedKey),
    [filteredRecords, selectedKey]
  );

  function openCreateClient() {
    setDraftMode("create-client");
    setClientDraft(EMPTY_CLIENT_DRAFT);
  }

  function openCreateOperator() {
    setDraftMode("create-operator");
    setOperatorDraft(EMPTY_OPERATOR_DRAFT);
  }

  function openEditSelected() {
    if (!selectedRecord) {
      return;
    }

    if (selectedRecord.kind === "client") {
      setDraftMode("edit-client");
      setClientDraft(buildClientDraft(selectedRecord.client));
      return;
    }

    setDraftMode("edit-operator");
    setOperatorDraft(buildOperatorDraft(selectedRecord.operator));
  }

  function cancelDraft() {
    setDraftMode(null);
  }

  async function saveLive(url: string, body: unknown, successMessage: string) {
    setSaving(true);
    try {
      const result = await adminRequest(url, "PATCH", body);
      toast.success(successMessage);
      if (result.warning) {
        toast.warning(result.warning);
      }
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the change.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function inviteLive(url: string, body: unknown, successMessage: string) {
    setSaving(true);
    try {
      const result = await adminRequest(url, "POST", body);
      toast.success(successMessage);
      if (result.warning) {
        toast.warning(result.warning);
      }
      router.refresh();
      return typeof result.id === "string" ? result.id : null;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the record.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleClientSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextNotes = toSentenceList(clientDraft.notes);

    if (draftMode === "create-client" && live) {
      const created = await inviteLive(
        "/api/admin/clients",
        {
          companyName: clientDraft.companyName.trim(),
          contactName: clientDraft.primaryContactName.trim(),
          email: clientDraft.primaryContactEmail.trim(),
          phone: clientDraft.primaryContactPhone.trim() || undefined,
          notes: clientDraft.notes
        },
        `Client added. We've emailed ${clientDraft.primaryContactEmail.trim()} a link to set their password.`
      );
      if (created) {
        setSelectedKey(`client:${created}`);
        setDraftMode(null);
      }
      return;
    }

    if (draftMode === "create-client") {
      const nextClient: ClientDetail = {
        id: generateId("client"),
        companyName: clientDraft.companyName.trim(),
        tradingName: clientDraft.tradingName.trim() || undefined,
        primaryContactName: clientDraft.primaryContactName.trim(),
        primaryContactEmail: clientDraft.primaryContactEmail.trim(),
        billingContactEmail: clientDraft.billingContactEmail.trim(),
        status: clientDraft.status,
        onboardingStatus: clientDraft.onboardingStatus,
        signupDate: new Date().toISOString(),
        activeAssignments: 0,
        futureAssignments: 0,
        lifetimeSpend: 0,
        monthlySpend: 0,
        outstandingBalance: 0,
        repeatBookingRate: 0,
        favouriteOperators: 0,
        blockedOperators: 0,
        lastActivityAt: new Date().toISOString(),
        notes: nextNotes,
        billingContactName: clientDraft.billingContactName.trim() || clientDraft.primaryContactName.trim(),
        primaryContactPhone: clientDraft.primaryContactPhone.trim() || "Not set",
        billingContactPhone: clientDraft.billingContactPhone.trim() || "Not set",
        address: clientDraft.address.trim() || "Not set",
        paymentHistory: [],
        assignments: [],
        preferredOperators: [],
        blockedOperatorProfiles: [],
        auditEntries: []
      };

      setClients((current) => [nextClient, ...current]);
      setSelectedKey(`client:${nextClient.id}`);
      setDraftMode(null);
      toast.success("Client profile added to the management desk.");
      return;
    }

    if (draftMode !== "edit-client" || !selectedRecord || selectedRecord.kind !== "client") {
      return;
    }

    if (live) {
      const original = selectedRecord.client;
      const saved = await saveLive(
        `/api/admin/clients/${original.id}`,
        {
          companyName: clientDraft.companyName.trim(),
          tradingName: clientDraft.tradingName.trim(),
          primaryContactName: clientDraft.primaryContactName.trim(),
          primaryContactEmail: clientDraft.primaryContactEmail.trim(),
          primaryContactPhone: clientDraft.primaryContactPhone.trim(),
          billingContactName: clientDraft.billingContactName.trim(),
          billingContactEmail: clientDraft.billingContactEmail.trim(),
          billingContactPhone: clientDraft.billingContactPhone.trim(),
          status: clientDraft.status,
          onboardingStatus: clientDraft.onboardingStatus,
          // The form shows the address as one line, so only send it when it was edited.
          addressLine1:
            clientDraft.address.trim() !== buildClientDraft(original).address.trim()
              ? clientDraft.address.trim()
              : undefined,
          notes: clientDraft.notes
        },
        "Client profile saved."
      );
      if (saved) {
        setDraftMode(null);
      }
      return;
    }

    const nextClient: ClientDetail = {
      ...selectedRecord.client,
      companyName: clientDraft.companyName.trim(),
      tradingName: clientDraft.tradingName.trim() || undefined,
      primaryContactName: clientDraft.primaryContactName.trim(),
      primaryContactEmail: clientDraft.primaryContactEmail.trim(),
      primaryContactPhone: clientDraft.primaryContactPhone.trim() || "Not set",
      billingContactName: clientDraft.billingContactName.trim() || clientDraft.primaryContactName.trim(),
      billingContactEmail: clientDraft.billingContactEmail.trim(),
      billingContactPhone: clientDraft.billingContactPhone.trim() || "Not set",
      status: clientDraft.status,
      onboardingStatus: clientDraft.onboardingStatus,
      address: clientDraft.address.trim() || "Not set",
      notes: nextNotes
    };

    setClients((current) =>
      current.map((client) => (client.id === nextClient.id ? nextClient : client))
    );
    setSelectedKey(`client:${nextClient.id}`);
    setDraftMode(null);
    toast.success("Client profile updated.");
  }

  async function handleOperatorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextNotes = toSentenceList(operatorDraft.notes);
    const nextRegions = toTagList(operatorDraft.regions);
    const nextSkillTags = toTagList(operatorDraft.skillTags);

    if (draftMode === "create-operator" && live) {
      const created = await inviteLive(
        "/api/admin/operators",
        {
          fullName: operatorDraft.displayName.trim(),
          email: operatorDraft.email.trim(),
          location: nextRegions[0],
          skillTags: nextSkillTags,
          notes: operatorDraft.notes
        },
        `Operator added. We've emailed ${operatorDraft.email.trim()} a link to set their password.`
      );
      if (created) {
        setSelectedKey(`operator:${created}`);
        setDraftMode(null);
      }
      return;
    }

    if (draftMode === "create-operator") {
      const nextOperator: OperatorDetail = {
        id: generateId("operator"),
        userId: generateId("profile"),
        displayName: operatorDraft.displayName.trim(),
        email: operatorDraft.email.trim(),
        verificationStatus: operatorDraft.verificationStatus,
        onboardingStatus: operatorDraft.onboardingStatus,
        regions: nextRegions,
        skillTags: nextSkillTags,
        averageRating: 0,
        totalCompleted: 0,
        totalCancellations: 0,
        totalNoShows: 0,
        repeatClients: 0,
        favouriteCount: 0,
        blockedCount: 0,
        complaintCount: 0,
        earningsYtd: 0,
        isActive: true,
        latestAssignmentAt: undefined,
        notes: nextNotes,
        completionRate: 0,
        assignments: [],
        repeatClientNames: [],
        favouritedByClients: [],
        documents: [],
        auditEntries: []
      };

      setOperators((current) => [nextOperator, ...current]);
      setSelectedKey(`operator:${nextOperator.id}`);
      setDraftMode(null);
      toast.success("Operator profile added to the management desk.");
      return;
    }

    if (draftMode !== "edit-operator" || !selectedRecord || selectedRecord.kind !== "operator") {
      return;
    }

    if (live) {
      const saved = await saveLive(
        `/api/admin/operators/${selectedRecord.operator.id}`,
        {
          displayName: operatorDraft.displayName.trim(),
          regions: nextRegions,
          skillTags: nextSkillTags,
          verificationStatus: operatorDraft.verificationStatus,
          onboardingStatus: operatorDraft.onboardingStatus,
          notes: operatorDraft.notes
        },
        "Operator profile saved."
      );
      if (saved) {
        setDraftMode(null);
      }
      return;
    }

    const nextOperator: OperatorDetail = {
      ...selectedRecord.operator,
      displayName: operatorDraft.displayName.trim(),
      email: operatorDraft.email.trim(),
      regions: nextRegions,
      skillTags: nextSkillTags,
      verificationStatus: operatorDraft.verificationStatus,
      onboardingStatus: operatorDraft.onboardingStatus,
      notes: nextNotes
    };

    setOperators((current) =>
      current.map((operator) => (operator.id === nextOperator.id ? nextOperator : operator))
    );
    setClients((current) =>
      current.map((client) => ({
        ...client,
        preferredOperators: client.preferredOperators.map((operator) =>
          operator.id === nextOperator.id
            ? {
                ...operator,
                displayName: nextOperator.displayName,
                verificationStatus: nextOperator.verificationStatus,
                averageRating: nextOperator.averageRating
              }
            : operator
        ),
        blockedOperatorProfiles: client.blockedOperatorProfiles.map((operator) =>
          operator.id === nextOperator.id
            ? {
                ...operator,
                displayName: nextOperator.displayName,
                verificationStatus: nextOperator.verificationStatus,
                averageRating: nextOperator.averageRating
              }
            : operator
        )
      }))
    );
    setSelectedKey(`operator:${nextOperator.id}`);
    setDraftMode(null);
    toast.success("Operator profile updated.");
  }

  async function toggleSelectedLifecycle() {
    if (!selectedRecord) {
      return;
    }

    if (live) {
      if (selectedRecord.kind === "client") {
        const nextStatus = selectedRecord.client.status === "inactive" ? "active" : "inactive";
        await saveLive(
          `/api/admin/clients/${selectedRecord.client.id}`,
          { status: nextStatus },
          nextStatus === "inactive" ? "Client suspended." : "Client reactivated."
        );
        return;
      }

      const nextIsActive = !selectedRecord.operator.isActive;
      await saveLive(
        `/api/admin/operators/${selectedRecord.operator.id}`,
        { isActive: nextIsActive },
        nextIsActive ? "Operator reactivated." : "Operator suspended."
      );
      return;
    }

    if (selectedRecord.kind === "client") {
      const nextStatus = selectedRecord.client.status === "inactive" ? "active" : "inactive";
      setClients((current) =>
        current.map((client) =>
          client.id === selectedRecord.client.id ? { ...client, status: nextStatus } : client
        )
      );
      toast.success(nextStatus === "inactive" ? "Client suspended." : "Client reactivated.");
      return;
    }

    const nextIsActive = !selectedRecord.operator.isActive;
    setOperators((current) =>
      current.map((operator) =>
        operator.id === selectedRecord.operator.id ? { ...operator, isActive: nextIsActive } : operator
      )
    );
    toast.success(nextIsActive ? "Operator reactivated." : "Operator suspended.");
  }

  function deleteSelected() {
    if (!selectedRecord) {
      return;
    }

    const confirmationMessage =
      selectedRecord.kind === "client"
        ? `Delete ${selectedRecord.client.companyName} from this management session?`
        : `Delete ${selectedRecord.operator.displayName} from this management session?`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    if (selectedRecord.kind === "client") {
      setClients((current) => current.filter((client) => client.id !== selectedRecord.client.id));
      toast.success("Client removed from the management desk.");
      return;
    }

    setOperators((current) =>
      current.filter((operator) => operator.id !== selectedRecord.operator.id)
    );
    setClients((current) =>
      current.map((client) => ({
        ...client,
        preferredOperators: client.preferredOperators.filter(
          (operator) => operator.id !== selectedRecord.operator.id
        ),
        blockedOperatorProfiles: client.blockedOperatorProfiles.filter(
          (operator) => operator.id !== selectedRecord.operator.id
        ),
        favouriteOperators: client.preferredOperators.filter(
          (operator) => operator.id !== selectedRecord.operator.id
        ).length,
        blockedOperators: client.blockedOperatorProfiles.filter(
          (operator) => operator.id !== selectedRecord.operator.id
        ).length
      }))
    );
    toast.success("Operator removed from the management desk.");
  }

  const activeClientCount = clients.filter((client) => client.status === "active").length;
  const activeOperatorCount = operators.filter((operator) => operator.isActive).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
      <div className="space-y-6">
        <Card className="rounded-[28px] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="warning">Scaffold management state</Badge>
                <p className="text-xs uppercase tracking-[0.16em] text-slate">
                  Search, filter, add, edit, suspend, and delete from the populated admin scaffold
                </p>
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.05em] text-ink">
                Client and operator lifecycle desk
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate">
                The live `clients`, `operators`, and `assignments` tables are still empty, so this desk runs on the
                admin scaffold for now while giving you a single place to manage lifecycle state and inspect full
                profile context.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={openCreateClient}>
                <Plus className="mr-2 h-4 w-4" />
                Add client
              </Button>
              <Button className="w-full sm:w-auto" onClick={openCreateOperator}>
                <Plus className="mr-2 h-4 w-4" />
                Add operator
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Field label="Search clients and operators" hint="Search by name, email, contact, region, skill, or notes.">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search the management desk"
                  className="pl-11"
                />
              </div>
            </Field>

            <Field label="Entity scope" hint={`${filteredRecords.length} matching records`}>
              <Select value={scope} onChange={(event) => setScope(event.target.value as EntityScope)}>
                <option value="both">Clients and operators</option>
                <option value="clients">Clients only</option>
                <option value="operators">Operators only</option>
              </Select>
            </Field>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Clients in desk</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{clients.length}</p>
              <p className="mt-2 text-sm text-slate">{activeClientCount} currently active</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Operators in desk</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{operators.length}</p>
              <p className="mt-2 text-sm text-slate">{activeOperatorCount} currently deployable</p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Filtered result set</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{filteredRecords.length}</p>
              <p className="mt-2 text-sm text-slate">Scope: {scope.replace(/s$/, "")} management view</p>
            </div>
          </div>
        </Card>

        <AdminDataTable
          columns={[
            { key: "entity", label: "Entity" },
            { key: "type", label: "Type" },
            { key: "lifecycle", label: "Lifecycle" },
            { key: "revenue", label: "Revenue / earnings" },
            { key: "activity", label: "Hosted / attended" },
            { key: "expected", label: "Expected booked value" }
          ]}
          rows={filteredRecords.map((record) => ({
            id: record.key,
            cells: {
              entity: (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedKey(record.key)}
                    className="text-left font-medium text-ink transition hover:text-mist"
                  >
                    {record.name}
                  </button>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate">{record.email}</p>
                  {selectedKey === record.key ? <Badge variant="accent">Selected</Badge> : null}
                </div>
              ),
              type: (
                <div className="flex items-center gap-2">
                  {record.kind === "client" ? (
                    <Building2 className="h-4 w-4 text-accent" />
                  ) : (
                    <Shield className="h-4 w-4 text-accent" />
                  )}
                  <span className="capitalize text-ink">{record.kind}</span>
                </div>
              ),
              lifecycle: (
                <div className="space-y-2">
                  <StatusBadge value={record.primaryStatus} />
                  <div>
                    <StatusBadge value={record.secondaryStatus} />
                  </div>
                </div>
              ),
              revenue: formatCurrency(record.revenueEarned),
              activity: (
                <div>
                  <p className="text-ink">{record.eventCount} events</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate">
                    {record.bookedHours.toFixed(1)} booked hrs ahead
                  </p>
                </div>
              ),
              expected: (
                <div>
                  <p className="text-ink">{formatCurrency(record.expectedValue)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate">
                    {record.nextActivityAt ? `Next ${formatDate(record.nextActivityAt)}` : "No next event"}
                  </p>
                </div>
              )
            }
          }))}
          emptyLabel="No clients or operators match the current search and scope."
        />
      </div>

      <div className="space-y-6">
        {draftMode === "create-client" || draftMode === "edit-client" ? (
          <InsightCard
            title={draftMode === "create-client" ? "Add client" : "Edit client"}
            description="Update client contacts, lifecycle status, billing identity, and internal notes."
          >
            <form className="grid gap-4" onSubmit={handleClientSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Company name">
                  <Input
                    value={clientDraft.companyName}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, companyName: event.target.value }))
                    }
                    required
                  />
                </Field>
                <Field label="Trading name">
                  <Input
                    value={clientDraft.tradingName}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, tradingName: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Primary contact">
                  <Input
                    value={clientDraft.primaryContactName}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, primaryContactName: event.target.value }))
                    }
                    required
                  />
                </Field>
                <Field label="Primary email">
                  <Input
                    type="email"
                    value={clientDraft.primaryContactEmail}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, primaryContactEmail: event.target.value }))
                    }
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Primary phone">
                  <Input
                    value={clientDraft.primaryContactPhone}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, primaryContactPhone: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Billing contact">
                  <Input
                    value={clientDraft.billingContactName}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, billingContactName: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Billing email">
                  <Input
                    type="email"
                    value={clientDraft.billingContactEmail}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, billingContactEmail: event.target.value }))
                    }
                    required
                  />
                </Field>
                <Field label="Billing phone">
                  <Input
                    value={clientDraft.billingContactPhone}
                    onChange={(event) =>
                      setClientDraft((current) => ({ ...current, billingContactPhone: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Lifecycle status">
                  <Select
                    value={clientDraft.status}
                    onChange={(event) =>
                      setClientDraft((current) => ({
                        ...current,
                        status: event.target.value as ClientDetail["status"]
                      }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="at_risk">At risk</option>
                  </Select>
                </Field>
                <Field label="Onboarding">
                  <Select
                    value={clientDraft.onboardingStatus}
                    onChange={(event) =>
                      setClientDraft((current) => ({
                        ...current,
                        onboardingStatus: event.target.value as ClientDetail["onboardingStatus"]
                      }))
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="in_review">In review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </Field>
              </div>

              <Field label="Address">
                <Input
                  value={clientDraft.address}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, address: event.target.value }))
                  }
                />
              </Field>

              <Field label="Internal notes" hint="Use one line per note.">
                <Textarea
                  value={clientDraft.notes}
                  onChange={(event) =>
                    setClientDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : draftMode === "create-client" ? (live ? "Create and invite" : "Create client") : "Save client"}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelDraft}>
                  Cancel
                </Button>
              </div>
            </form>
          </InsightCard>
        ) : null}

        {draftMode === "create-operator" || draftMode === "edit-operator" ? (
          <InsightCard
            title={draftMode === "create-operator" ? "Add operator" : "Edit operator"}
            description="Manage profile identity, deployment regions, skills, verification, and notes."
          >
            <form className="grid gap-4" onSubmit={handleOperatorSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Display name">
                  <Input
                    value={operatorDraft.displayName}
                    onChange={(event) =>
                      setOperatorDraft((current) => ({ ...current, displayName: event.target.value }))
                    }
                    required
                  />
                </Field>
                <Field
                  label="Email"
                  hint={
                    live && draftMode === "edit-operator"
                      ? "This is their sign-in email. They can change it from their own account."
                      : undefined
                  }
                >
                  <Input
                    type="email"
                    disabled={live && draftMode === "edit-operator"}
                    value={operatorDraft.email}
                    onChange={(event) =>
                      setOperatorDraft((current) => ({ ...current, email: event.target.value }))
                    }
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Regions" hint="Comma-separated list.">
                  <Input
                    value={operatorDraft.regions}
                    onChange={(event) =>
                      setOperatorDraft((current) => ({ ...current, regions: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Skill tags" hint="Comma-separated list.">
                  <Input
                    value={operatorDraft.skillTags}
                    onChange={(event) =>
                      setOperatorDraft((current) => ({ ...current, skillTags: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Verification">
                  <Select
                    value={operatorDraft.verificationStatus}
                    onChange={(event) =>
                      setOperatorDraft((current) => ({
                        ...current,
                        verificationStatus: event.target.value as OperatorDetail["verificationStatus"]
                      }))
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="in_review">In review</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </Field>
                <Field label="Onboarding">
                  <Select
                    value={operatorDraft.onboardingStatus}
                    onChange={(event) =>
                      setOperatorDraft((current) => ({
                        ...current,
                        onboardingStatus: event.target.value as OperatorDetail["onboardingStatus"]
                      }))
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="in_review">In review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </Field>
              </div>

              <Field label="Internal notes" hint="Use one line per note.">
                <Textarea
                  value={operatorDraft.notes}
                  onChange={(event) =>
                    setOperatorDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : draftMode === "create-operator"
                      ? live
                        ? "Create and invite"
                        : "Create operator"
                      : "Save operator"}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelDraft}>
                  Cancel
                </Button>
              </div>
            </form>
          </InsightCard>
        ) : null}

        {selectedRecord ? (
          <>
            <InsightCard
              title={`${selectedRecord.kind === "client" ? "Client" : "Operator"} profile`}
              description="Full profile, booked-value forecasting, event activity, and lifecycle controls for the selected record."
            >
              <div className="space-y-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display text-3xl font-semibold tracking-[-0.05em] text-ink">
                        {selectedRecord.name}
                      </p>
                      <Badge variant="neutral">{selectedRecord.kind}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate">{selectedRecord.email}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge value={selectedRecord.primaryStatus} />
                      <StatusBadge value={selectedRecord.secondaryStatus} />
                      {selectedRecord.kind === "operator" ? (
                        <StatusBadge
                          value={selectedRecord.operator.isActive ? "active" : "inactive"}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={openEditSelected}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={toggleSelectedLifecycle}
                      disabled={saving}
                    >
                      {selectedRecord.primaryStatus === "inactive" ? (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      ) : (
                        <PauseCircle className="mr-2 h-4 w-4" />
                      )}
                      {selectedRecord.primaryStatus === "inactive" ? "Reactivate" : "Suspend"}
                    </Button>
                    {live ? null : (
                      <Button variant="secondary" className="w-full sm:w-auto" onClick={deleteSelected}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    )}
                    <Link href={selectedRecord.detailHref} className="block">
                      <Button className="w-full sm:w-auto">
                        Open detail page <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="rounded-[22px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
                      {selectedRecord.kind === "client" ? "Revenue billed" : "Earnings YTD"}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-ink">
                      {formatCurrency(selectedRecord.revenueEarned)}
                    </p>
                  </Card>
                  <Card className="rounded-[22px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
                      {selectedRecord.kind === "client" ? "Events hosted" : "Events attended"}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-ink">{selectedRecord.eventCount}</p>
                  </Card>
                  <Card className="rounded-[22px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
                      Future booked hours
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-ink">
                      {selectedRecord.bookedHours.toFixed(1)} hrs
                    </p>
                  </Card>
                  <Card className="rounded-[22px] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
                      {selectedRecord.kind === "client" ? "Projected billed value" : "Projected earnings"}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-ink">
                      {formatCurrency(selectedRecord.expectedValue)}
                    </p>
                  </Card>
                </div>
              </div>
            </InsightCard>

            <AdminDataTable
              columns={[
                { key: "field", label: "Field" },
                { key: "value", label: "Value" }
              ]}
              rows={
                selectedRecord.kind === "client"
                  ? [
                      { id: "company", cells: { field: "Company", value: selectedRecord.client.companyName } },
                      {
                        id: "trading",
                        cells: { field: "Trading name", value: selectedRecord.client.tradingName ?? "Not set" }
                      },
                      {
                        id: "primary_contact",
                        cells: { field: "Primary contact", value: selectedRecord.client.primaryContactName }
                      },
                      {
                        id: "primary_email",
                        cells: { field: "Primary email", value: selectedRecord.client.primaryContactEmail }
                      },
                      {
                        id: "primary_phone",
                        cells: { field: "Primary phone", value: selectedRecord.client.primaryContactPhone }
                      },
                      {
                        id: "billing_contact",
                        cells: { field: "Billing contact", value: selectedRecord.client.billingContactName }
                      },
                      {
                        id: "billing_email",
                        cells: { field: "Billing email", value: selectedRecord.client.billingContactEmail }
                      },
                      {
                        id: "billing_phone",
                        cells: { field: "Billing phone", value: selectedRecord.client.billingContactPhone }
                      },
                      { id: "address", cells: { field: "Address", value: selectedRecord.client.address } },
                      {
                        id: "signup",
                        cells: { field: "Signup date", value: formatDate(selectedRecord.client.signupDate) }
                      },
                      {
                        id: "repeat",
                        cells: {
                          field: "Repeat booking rate",
                          value: `${selectedRecord.client.repeatBookingRate}%`
                        }
                      },
                      {
                        id: "balances",
                        cells: {
                          field: "Outstanding balance",
                          value: formatCurrency(selectedRecord.client.outstandingBalance)
                        }
                      },
                      {
                        id: "favourites",
                        cells: {
                          field: "Preferred / blocked operators",
                          value: `${selectedRecord.client.favouriteOperators} preferred / ${selectedRecord.client.blockedOperators} blocked`
                        }
                      }
                    ]
                  : [
                      {
                        id: "display_name",
                        cells: { field: "Display name", value: selectedRecord.operator.displayName }
                      },
                      { id: "email", cells: { field: "Email", value: selectedRecord.operator.email } },
                      {
                        id: "regions",
                        cells: {
                          field: "Regions",
                          value: selectedRecord.operator.regions.join(", ") || "No regions set"
                        }
                      },
                      {
                        id: "skills",
                        cells: {
                          field: "Skill tags",
                          value: selectedRecord.operator.skillTags.join(", ") || "No skills set"
                        }
                      },
                      {
                        id: "verification",
                        cells: {
                          field: "Verification",
                          value: selectedRecord.operator.verificationStatus.replace(/_/g, " ")
                        }
                      },
                      {
                        id: "onboarding",
                        cells: {
                          field: "Onboarding",
                          value: selectedRecord.operator.onboardingStatus.replace(/_/g, " ")
                        }
                      },
                      {
                        id: "completion",
                        cells: {
                          field: "Completion rate",
                          value: `${Math.round(selectedRecord.operator.completionRate * 100)}%`
                        }
                      },
                      {
                        id: "attendance",
                        cells: {
                          field: "Completed / cancelled / no-show",
                          value: `${selectedRecord.operator.totalCompleted} / ${selectedRecord.operator.totalCancellations} / ${selectedRecord.operator.totalNoShows}`
                        }
                      },
                      {
                        id: "rating",
                        cells: {
                          field: "Average rating",
                          value: selectedRecord.operator.averageRating.toFixed(2)
                        }
                      },
                      {
                        id: "clients",
                        cells: {
                          field: "Repeat / favourite / blocked clients",
                          value: `${selectedRecord.operator.repeatClients} / ${selectedRecord.operator.favouriteCount} / ${selectedRecord.operator.blockedCount}`
                        }
                      },
                      {
                        id: "complaints",
                        cells: { field: "Complaint count", value: selectedRecord.operator.complaintCount }
                      }
                    ]
              }
            />

            <AdminDataTable
              columns={[
                { key: "assignment", label: "Assignments" },
                { key: "timing", label: "Timing" },
                { key: "booked", label: "Booked hours" },
                { key: "value", label: selectedRecord.kind === "client" ? "Charge value" : "Pay value" }
              ]}
              rows={
                (selectedRecord.kind === "client"
                  ? selectedRecord.client.assignments
                  : selectedRecord.operator.assignments
                ).map((assignment) => ({
                  id: assignment.id,
                  cells: {
                    assignment: (
                      <div>
                        <p className="font-medium text-ink">{assignment.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate">
                          {selectedRecord.kind === "client"
                            ? assignment.locationName
                            : assignment.clientName}
                        </p>
                      </div>
                    ),
                    timing: `${formatDateTime(assignment.startsAt)} to ${formatDateTime(assignment.endsAt)}`,
                    booked: `${assignmentHours(assignment).toFixed(1)} hrs`,
                    value:
                      selectedRecord.kind === "client"
                        ? formatCurrency(assignment.totalChargeAmount)
                        : formatCurrency(assignment.totalPayAmount)
                  }
                }))
              }
              emptyLabel="No hosted or attended events are attached to this profile yet."
            />

            <div className="grid gap-6 xl:grid-cols-2">
              <InsightCard
                title="Internal notes"
                description="Profile notes, operational context, and anything worth carrying into the next admin decision."
              >
                <div className="space-y-3">
                  {(selectedRecord.kind === "client"
                    ? selectedRecord.client.notes
                    : selectedRecord.operator.notes
                  ).length > 0 ? (
                    (selectedRecord.kind === "client"
                      ? selectedRecord.client.notes
                      : selectedRecord.operator.notes
                    ).map((note, index) => (
                      <div key={`${selectedRecord.key}-note-${index}`} className="rounded-[18px] bg-white/[0.03] px-4 py-3 text-sm leading-7 text-slate">
                        {note}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate">No internal notes recorded.</p>
                  )}
                </div>
              </InsightCard>

              <InsightCard
                title="Profile context"
                description="Quick operational context around this entity's current place in the Athena network."
              >
                <div className="space-y-3 text-sm text-slate">
                  {selectedRecord.kind === "client" ? (
                    <>
                      <p>
                        Preferred operators: {selectedRecord.client.preferredOperators.length}
                      </p>
                      <p>
                        Blocked operators: {selectedRecord.client.blockedOperatorProfiles.length}
                      </p>
                      <p>
                        Payment records: {selectedRecord.client.paymentHistory.length}
                      </p>
                      <p>
                        Last known activity:{" "}
                        {selectedRecord.client.lastActivityAt
                          ? formatDateTime(selectedRecord.client.lastActivityAt)
                          : "Not recorded"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Favourited by clients: {selectedRecord.operator.favouritedByClients.length}
                      </p>
                      <p>
                        Compliance documents: {selectedRecord.operator.documents.length}
                      </p>
                      <p>
                        Latest assignment:{" "}
                        {selectedRecord.operator.latestAssignmentAt
                          ? formatDateTime(selectedRecord.operator.latestAssignmentAt)
                          : "Not recorded"}
                      </p>
                      <p>Current active state: {selectedRecord.operator.isActive ? "Deployable" : "Suspended"}</p>
                    </>
                  )}
                </div>
              </InsightCard>
            </div>
          </>
        ) : (
          <InsightCard
            title="No profile selected"
            description="Use the search and scope filters to narrow the desk, then select a record to manage."
          >
            <p className="text-sm text-slate">No client or operator is available under the current filters.</p>
          </InsightCard>
        )}
      </div>
    </div>
  );
}
