"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { useGetMeQuery, useUpdateUserMutation } from "@/redux/api/usersApi";
import { useUpdateOrganizationMutation } from "@/redux/api/organizationApi";
import { z } from "zod";
import AdminLoadingState from "@/components/admin/UI/AdminLoadingState";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import ProfileSummaryStrip from "@/components/admin/profile/ProfileSummaryStrip";
import ProfileIdentityCard from "@/components/admin/profile/ProfileIdentityCard";
import PersonalDetailsCard from "@/components/admin/profile/PersonalDetailsCard";
import OrganizationBrandingCard from "@/components/admin/profile/OrganizationBrandingCard";
import SecurityCard from "@/components/admin/profile/SecurityCard";
import {
    formatDateTime,
    getDisplayName,
    getInitials,
    getOrganizationDetails,
    getRoleLabel,
    getStatusLabel,
    getStatusTone,
    getWorkspaceDescriptor,
} from "@/components/admin/profile/profile-utils";
import { useOrgContext } from "@/hooks/useOrgContext";

type ProfileFormData = {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
};

type ProfileFormErrors = Partial<Record<keyof ProfileFormData, string>>;

const getErrorMessage = (error: unknown, fallback: string) => {
    if (
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        typeof (error as { data?: unknown }).data === "object" &&
        (error as { data?: { message?: string } }).data?.message
    ) {
        return (error as { data?: { message?: string } }).data?.message || fallback;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

export default function ProfilePage() {
    const { data: userData, isLoading, error } = useGetMeQuery(undefined, { refetchOnMountOrArgChange: true });
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
    const [updateOrganization, { isLoading: isUpdatingOrg }] = useUpdateOrganizationMutation();
    const { orgName: orgNameFromSession, role: sessionRole } = useOrgContext();

    const user = userData?.data;
    const organization = getOrganizationDetails(user?.organizationId, user?.organizationName || orgNameFromSession);
    const roleLabel = getRoleLabel(user?.role || sessionRole);
    const statusLabel = getStatusLabel(user?.status);
    const statusTone = getStatusTone(user?.status);
    const displayName = getDisplayName(user);
    const userInitials = getInitials(user);
    const workspaceDescriptor = getWorkspaceDescriptor({
        role: user?.role || sessionRole,
        parentOrganizationId: organization.parentOrganizationId,
    });
    const logoUrl = organization.logo ? `http://localhost:5000${organization.logo}` : null;
    const canEditLogo = Boolean(user && organization.id && (!organization.parentOrganizationId || user.role === "superadmin"));
    const lastUpdated = formatDateTime(user?.updatedAt);
    const lastLogin = formatDateTime(user?.lastLoginAt || user?.lastLogin || user?.lastSeen);

    const serverFormData = useMemo<ProfileFormData>(() => ({
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        email: user?.email || "",
        mobile: user?.mobile || "",
    }), [user?.email, user?.firstName, user?.lastName, user?.mobile]);

    const [draftFormData, setDraftFormData] = useState<ProfileFormData | null>(null);
    const [errors, setErrors] = useState<ProfileFormErrors>({});
    const formData = draftFormData ?? serverFormData;

    const profileSchema = z.object({
        firstName: z.string().min(1, "First Name is required."),
        lastName: z.string().min(1, "Last Name is required."),
        email: z.string().email("Valid Email is required."),
        mobile: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Enter valid mobile with country code"),
    });

    const handleBlur = (name: keyof ProfileFormData, value: string) => {
        const result = profileSchema.shape[name].safeParse(value);
        setErrors((prev) => ({
            ...prev,
            [name]: result.success ? "" : result.error.issues[0]?.message || "Invalid value",
        }));
    };

    const handleFormDataChange = (
        nextValue:
            | ProfileFormData
            | ((previous: ProfileFormData) => ProfileFormData),
    ) => {
        const previous = draftFormData ?? serverFormData;
        setDraftFormData(typeof nextValue === "function" ? nextValue(previous) : nextValue);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const parsed = profileSchema.safeParse(formData);
        if (!parsed.success) {
            const nextErrors: ProfileFormErrors = {};
            parsed.error.issues.forEach((issue) => {
                const key = issue.path[0] as keyof ProfileFormData;
                if (!nextErrors[key]) nextErrors[key] = issue.message;
            });
            setErrors(nextErrors);
            toast.error("Please fix profile errors");
            return;
        }

        try {
            // Only update allowed fields
            const payload = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                mobile: formData.mobile,
                status: user.status
            };

            await updateUser({ id: user._id, ...payload }).unwrap();
            setDraftFormData(null);
            toast.success("Profile updated successfully");
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, "Update failed"));
        }
    };

    const handleLogoChange = async (file: File) => {
        if (!organization.id) return;

        const uploadData = new FormData();
        uploadData.append("logo", file);

        try {
            await updateOrganization({ id: organization.id, body: uploadData }).unwrap();
            toast.success("Logo updated successfully");
        } catch (err: unknown) {
            toast.error(getErrorMessage(err, "Logo update failed"));
        }
    };

    if (isLoading) {
        return <AdminLoadingState title="Loading profile" description="Preparing your account details and organization branding." />;
    }

    if (error) {
        return (
            <div className="p-8 text-red-500 font-bold text-center bg-red-50 rounded-xl border border-red-100">
                Failed to load profile.
            </div>
        );
    }

    return (
        <ApiErrorBoundary hasError={false}>
            <AdminPageShell className="max-w-7xl" contentClassName="space-y-6 sm:space-y-8">
                <AdminPageHeader
                    eyebrow="Account"
                    title="Profile"
                    description="Manage your account details, security, and organization identity."
                />
                <ProfileSummaryStrip
                    name={displayName}
                    roleLabel={roleLabel}
                    organizationName={organization.name}
                    statusLabel={statusLabel}
                    statusTone={statusTone}
                    email={user?.email}
                    lastUpdated={lastUpdated}
                    lastLogin={lastLogin}
                />

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:gap-8">
                    <div className="space-y-6">
                        <ProfileIdentityCard
                            initials={userInitials}
                            name={displayName}
                            email={user?.email}
                            roleLabel={roleLabel}
                            statusLabel={statusLabel}
                            statusTone={statusTone}
                            descriptor={workspaceDescriptor}
                        />

                        <OrganizationBrandingCard
                            organizationName={organization.name}
                            logoUrl={logoUrl}
                            workspaceDescriptor={workspaceDescriptor}
                            canEditLogo={canEditLogo}
                            isUpdatingLogo={isUpdatingOrg}
                            onLogoChange={handleLogoChange}
                        />

                    </div>

                    <div className="space-y-6">
                        <PersonalDetailsCard
                            formData={formData}
                            errors={errors}
                            roleLabel={roleLabel}
                            organizationName={organization.name}
                            isSubmitting={isUpdating}
                            onBlur={handleBlur}
                            onSubmit={handleSubmit}
                            setFormData={handleFormDataChange}
                        />

                        <SecurityCard
                            canChangePassword={false}
                            lastPasswordUpdate={null}
                            lastLogin={lastLogin}
                        />
                    </div>
                </div>
            </AdminPageShell>
        </ApiErrorBoundary>
    );
}
