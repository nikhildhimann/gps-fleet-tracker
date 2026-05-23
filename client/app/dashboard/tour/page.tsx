import DashboardLayout from "@/components/dashboard/layout-wrapper"
import { Share2 } from "lucide-react"

export default function TourPage() {
    return (
        <DashboardLayout>
            <div className="flex h-full flex-col items-center justify-center text-slate-500 gap-4">
                <Share2 className="h-16 w-16 text-slate-300" />
                <h1 className="text-2xl font-bold text-slate-700">Tour Management</h1>
                <p>This feature is currently under development.</p>
            </div>
        </DashboardLayout>
    )
}
