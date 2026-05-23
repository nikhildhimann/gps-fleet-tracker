import DashboardLayout from "@/components/dashboard/layout-wrapper"
import { Construction } from "lucide-react"

export default function ReportsPage() {
    return (
        <DashboardLayout>
            <div className="flex h-full flex-col items-center justify-center text-slate-500 gap-4">
                <Construction className="h-16 w-16 text-slate-300" />
                <h1 className="text-2xl font-bold text-slate-700">Reports Module</h1>
                <p>This feature is currently under development.</p>
            </div>
        </DashboardLayout>
    )
}
