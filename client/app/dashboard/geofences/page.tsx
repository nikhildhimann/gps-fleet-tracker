import DashboardLayout from "@/components/dashboard/layout-wrapper"
import { Shield } from "lucide-react"

export default function GeofencesPage() {
    return (
        <DashboardLayout>
            <div className="flex h-full flex-col items-center justify-center text-slate-500 gap-4">
                <Shield className="h-16 w-16 text-slate-300" />
                <h1 className="text-2xl font-bold text-slate-700">Geofences</h1>
                <p>This feature is currently under development.</p>
            </div>
        </DashboardLayout>
    )
}
