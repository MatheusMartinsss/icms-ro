"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Icmsro } from "@/components/icms-ro-form";
import { Icmsam } from "@/components/icms-am-form";

export default function Home() {

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-[800px]">
        <Tabs defaultValue="icms-ro" className="w-full">
          <TabsList className="flex justify-start w-full">
            <TabsTrigger value="icms-ro">ICMS Rondônia</TabsTrigger>
            <TabsTrigger value="icms-am">ICMS Amazonas</TabsTrigger>
            <TabsTrigger value="icms-mt">ICMS Matogrosso</TabsTrigger>
          </TabsList>
          <TabsContent value="icms-ro">
            <Icmsro />
          </TabsContent>
          <TabsContent value="icms-am">
            <Icmsam />
          </TabsContent>
          <TabsContent value="icms-mt">
            <div className="h-screen"></div>
          </TabsContent>
        </Tabs>
      </div>
    </main>

  );
}

