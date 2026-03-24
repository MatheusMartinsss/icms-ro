'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
    { label: 'CT-e',          href: '/'               },
    { label: 'MDF-e',         href: '/mdfe'            },
    { label: 'Calculadora',   href: '/calculadora'     },
    { label: 'Configurações', href: '/configuracoes'   },
]

export function Navbar() {
    const pathname = usePathname()

    function isActive(href: string) {
        if (href === '/') return pathname === '/'
        return pathname === href || pathname.startsWith(href + '/')
    }

    return (
        <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
            <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2.5 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">F</div>
                    <span className="font-semibold text-slate-800">FreteCalc</span>
                </Link>

                <nav className="flex items-center gap-1">
                    {NAV_ITEMS.map(item => (
                        <Link key={item.href} href={item.href}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive(item.href) ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto">
                    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}
                        className="text-slate-500 hover:text-slate-800">
                        Sair
                    </Button>
                </div>
            </div>
        </header>
    )
}
