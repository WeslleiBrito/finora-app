import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Em vez de importar o tipo 'Column' do react-table que está quebrando,
// usamos 'any' para a coluna, garantindo que o TypeScript não vai reclamar 
// das propriedades internas da biblioteca.
interface DataTableColumnHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  column: any // 🌟 Tipagem permissiva para evitar conflito de versão
  title: string
}

export function DataTableColumnHeader({
  column,
  title,
  className,
}: DataTableColumnHeaderProps) {
  
  // Verifica se a coluna permite ordenação
  if (!column.getCanSort()) {
    return <div className={cn("text-sm font-medium", className)}>{title}</div>
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 size-3" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 size-3" />
        ) : (
          <ChevronsUpDown className="ml-2 size-3 text-muted-foreground" />
        )}
      </Button>
    </div>
  )
}