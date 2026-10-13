export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: string
          descripcion: string
          fecha: string
          id: string
          modulo: string
          registro_id: string | null
          usuario_id: string | null
        }
        Insert: {
          accion: string
          descripcion: string
          fecha?: string
          id?: string
          modulo: string
          registro_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          descripcion?: string
          fecha?: string
          id?: string
          modulo?: string
          registro_id?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      cajas: {
        Row: {
          abierta_at: string
          abierta_por: string | null
          cerrada_at: string | null
          cerrada_por: string | null
          diferencia: number | null
          estado: string
          id: string
          monto_contado: number | null
          monto_inicial: number
          observaciones: string | null
          total_esperado: number | null
        }
        Insert: {
          abierta_at?: string
          abierta_por?: string | null
          cerrada_at?: string | null
          cerrada_por?: string | null
          diferencia?: number | null
          estado?: string
          id?: string
          monto_contado?: number | null
          monto_inicial?: number
          observaciones?: string | null
          total_esperado?: number | null
        }
        Update: {
          abierta_at?: string
          abierta_por?: string | null
          cerrada_at?: string | null
          cerrada_por?: string | null
          diferencia?: number | null
          estado?: string
          id?: string
          monto_contado?: number | null
          monto_inicial?: number
          observaciones?: string | null
          total_esperado?: number | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          comprobante: string | null
          confirmada_at: string | null
          created_at: string
          descuento: number
          estado: Database["public"]["Enums"]["estado_compra"]
          fecha: string
          id: string
          numero: string
          observaciones: string | null
          proveedor_id: string | null
          subtotal: number
          total: number
          usuario_id: string | null
        }
        Insert: {
          comprobante?: string | null
          confirmada_at?: string | null
          created_at?: string
          descuento?: number
          estado?: Database["public"]["Enums"]["estado_compra"]
          fecha?: string
          id?: string
          numero: string
          observaciones?: string | null
          proveedor_id?: string | null
          subtotal?: number
          total?: number
          usuario_id?: string | null
        }
        Update: {
          comprobante?: string | null
          confirmada_at?: string | null
          created_at?: string
          descuento?: number
          estado?: Database["public"]["Enums"]["estado_compra"]
          fecha?: string
          id?: string
          numero?: string
          observaciones?: string | null
          proveedor_id?: string | null
          subtotal?: number
          total?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          clave: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          clave: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          clave?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      detalle_compras: {
        Row: {
          cantidad: number
          compra_id: string
          id: string
          precio_costo: number
          producto_id: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          compra_id: string
          id?: string
          precio_costo?: number
          producto_id: string
          subtotal?: number
        }
        Update: {
          cantidad?: number
          compra_id?: string
          id?: string
          precio_costo?: number
          producto_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_compras_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_compras_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      detalle_ventas: {
        Row: {
          cantidad: number
          categoria_id: string | null
          costo_unitario: number
          descripcion: string
          id: string
          precio_unitario: number
          producto_id: string | null
          servicio_id: string | null
          subtotal: number
          venta_id: string
        }
        Insert: {
          cantidad: number
          categoria_id?: string | null
          costo_unitario?: number
          descripcion: string
          id?: string
          precio_unitario: number
          producto_id?: string | null
          servicio_id?: string | null
          subtotal: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          categoria_id?: string | null
          costo_unitario?: number
          descripcion?: string
          id?: string
          precio_unitario?: number
          producto_id?: string | null
          servicio_id?: string | null
          subtotal?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          caja_id: string | null
          concepto: string
          fecha: string
          id: string
          importe: number
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          tipo: Database["public"]["Enums"]["tipo_mov_caja"]
          usuario_id: string | null
          venta_id: string | null
        }
        Insert: {
          caja_id?: string | null
          concepto: string
          fecha?: string
          id?: string
          importe: number
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          tipo: Database["public"]["Enums"]["tipo_mov_caja"]
          usuario_id?: string | null
          venta_id?: string | null
        }
        Update: {
          caja_id?: string | null
          concepto?: string
          fecha?: string
          id?: string
          importe?: number
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          tipo?: Database["public"]["Enums"]["tipo_mov_caja"]
          usuario_id?: string | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_stock: {
        Row: {
          cantidad: number
          fecha: string
          id: string
          motivo: string | null
          producto_id: string
          referencia_id: string | null
          stock_resultante: number | null
          tipo: Database["public"]["Enums"]["tipo_mov_stock"]
          usuario_id: string | null
        }
        Insert: {
          cantidad: number
          fecha?: string
          id?: string
          motivo?: string | null
          producto_id: string
          referencia_id?: string | null
          stock_resultante?: number | null
          tipo: Database["public"]["Enums"]["tipo_mov_stock"]
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          fecha?: string
          id?: string
          motivo?: string | null
          producto_id?: string
          referencia_id?: string | null
          stock_resultante?: number | null
          tipo?: Database["public"]["Enums"]["tipo_mov_stock"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria_id: string | null
          codigo_barras: string | null
          created_at: string
          descripcion: string | null
          id: string
          marca: string | null
          nombre: string
          precio_costo: number
          precio_venta: number
          proveedor_id: string | null
          punto_reposicion: number
          sku: string
          stock_actual: number
          stock_minimo: number
          stock_objetivo: number
          tipo: Database["public"]["Enums"]["tipo_item"]
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          marca?: string | null
          nombre: string
          precio_costo?: number
          precio_venta?: number
          proveedor_id?: string | null
          punto_reposicion?: number
          sku: string
          stock_actual?: number
          stock_minimo?: number
          stock_objetivo?: number
          tipo?: Database["public"]["Enums"]["tipo_item"]
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          marca?: string | null
          nombre?: string
          precio_costo?: number
          precio_venta?: number
          proveedor_id?: string | null
          punto_reposicion?: number
          sku?: string
          stock_actual?: number
          stock_minimo?: number
          stock_objetivo?: number
          tipo?: Database["public"]["Enums"]["tipo_item"]
          unidad?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_proveedores: {
        Row: {
          costo: number | null
          id: string
          producto_id: string
          proveedor_id: string
        }
        Insert: {
          costo?: number | null
          id?: string
          producto_id: string
          proveedor_id: string
        }
        Update: {
          costo?: number | null
          id?: string
          producto_id?: string
          proveedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_proveedores_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_proveedores_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          apellido: string
          created_at: string
          email: string
          id: string
          nombre: string
          ultimo_acceso: string | null
        }
        Insert: {
          activo?: boolean
          apellido?: string
          created_at?: string
          email?: string
          id: string
          nombre?: string
          ultimo_acceso?: string | null
        }
        Update: {
          activo?: boolean
          apellido?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          ultimo_acceso?: string | null
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          contacto: string | null
          created_at: string
          cuit: string | null
          direccion: string | null
          email: string | null
          id: string
          nombre: string
          observaciones: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre: string
          observaciones?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          cuit?: string | null
          direccion?: string | null
          email?: string | null
          id?: string
          nombre?: string
          observaciones?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      servicios: {
        Row: {
          activo: boolean
          clase: Database["public"]["Enums"]["clase_servicio"]
          color: boolean
          created_at: string
          doble_faz: boolean
          id: string
          insumo_id: string | null
          nombre: string
          precio_unitario: number
          tamano: string
          tipo_papel: string | null
        }
        Insert: {
          activo?: boolean
          clase: Database["public"]["Enums"]["clase_servicio"]
          color?: boolean
          created_at?: string
          doble_faz?: boolean
          id?: string
          insumo_id?: string | null
          nombre: string
          precio_unitario?: number
          tamano?: string
          tipo_papel?: string | null
        }
        Update: {
          activo?: boolean
          clase?: Database["public"]["Enums"]["clase_servicio"]
          color?: boolean
          created_at?: string
          doble_faz?: boolean
          id?: string
          insumo_id?: string | null
          nombre?: string
          precio_unitario?: number
          tamano?: string
          tipo_papel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ventas: {
        Row: {
          anulada_at: string | null
          anulada_por: string | null
          caja_id: string | null
          descuento: number
          estado: Database["public"]["Enums"]["estado_venta"]
          fecha: string
          id: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          motivo_anulacion: string | null
          numero: string
          observaciones: string | null
          subtotal: number
          total: number
          usuario_id: string | null
        }
        Insert: {
          anulada_at?: string | null
          anulada_por?: string | null
          caja_id?: string | null
          descuento?: number
          estado?: Database["public"]["Enums"]["estado_venta"]
          fecha?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          motivo_anulacion?: string | null
          numero: string
          observaciones?: string | null
          subtotal?: number
          total?: number
          usuario_id?: string | null
        }
        Update: {
          anulada_at?: string | null
          anulada_por?: string | null
          caja_id?: string | null
          descuento?: number
          estado?: Database["public"]["Enums"]["estado_venta"]
          fecha?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          motivo_anulacion?: string | null
          numero?: string
          observaciones?: string | null
          subtotal?: number
          total?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_caja_id_fkey"
            columns: ["caja_id"]
            isOneToOne: false
            referencedRelation: "cajas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anular_venta: {
        Args: { p_motivo: string; p_venta_id: string }
        Returns: undefined
      }
      bootstrap_usuario: {
        Args: { p_apellido: string; p_email: string; p_nombre: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      caja_abierta_actual: { Args: never; Returns: string }
      cerrar_caja: {
        Args: {
          p_caja_id: string
          p_monto_contado: number
          p_observaciones?: string
        }
        Returns: {
          abierta_at: string
          abierta_por: string | null
          cerrada_at: string | null
          cerrada_por: string | null
          diferencia: number | null
          estado: string
          id: string
          monto_contado: number | null
          monto_inicial: number
          observaciones: string | null
          total_esperado: number | null
        }
        SetofOptions: {
          from: "*"
          to: "cajas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirmar_compra: { Args: { p_compra_id: string }; Returns: undefined }
      crear_venta: {
        Args: {
          p_descuento?: number
          p_items: Json
          p_metodo: Database["public"]["Enums"]["metodo_pago"]
          p_observaciones?: string
        }
        Returns: {
          anulada_at: string | null
          anulada_por: string | null
          caja_id: string | null
          descuento: number
          estado: Database["public"]["Enums"]["estado_venta"]
          fecha: string
          id: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          motivo_anulacion: string | null
          numero: string
          observaciones: string | null
          subtotal: number
          total: number
          usuario_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "ventas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      log_auditoria: {
        Args: {
          _accion: string
          _descripcion: string
          _modulo: string
          _registro: string
        }
        Returns: undefined
      }
      registrar_movimiento_stock: {
        Args: {
          p_cantidad: number
          p_motivo: string
          p_producto_id: string
          p_tipo: Database["public"]["Enums"]["tipo_mov_stock"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "vendedor"
      clase_servicio: "fotocopia" | "impresion"
      estado_compra: "borrador" | "confirmada" | "anulada"
      estado_venta: "confirmada" | "anulada"
      metodo_pago:
        | "efectivo"
        | "transferencia"
        | "debito"
        | "credito"
        | "mercadopago"
        | "otro"
      tipo_item: "producto" | "insumo"
      tipo_mov_caja:
        | "apertura"
        | "venta"
        | "ingreso"
        | "retiro"
        | "gasto"
        | "ajuste"
      tipo_mov_stock:
        | "entrada"
        | "salida"
        | "ajuste"
        | "venta"
        | "anulacion"
        | "compra"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor"],
      clase_servicio: ["fotocopia", "impresion"],
      estado_compra: ["borrador", "confirmada", "anulada"],
      estado_venta: ["confirmada", "anulada"],
      metodo_pago: [
        "efectivo",
        "transferencia",
        "debito",
        "credito",
        "mercadopago",
        "otro",
      ],
      tipo_item: ["producto", "insumo"],
      tipo_mov_caja: [
        "apertura",
        "venta",
        "ingreso",
        "retiro",
        "gasto",
        "ajuste",
      ],
      tipo_mov_stock: [
        "entrada",
        "salida",
        "ajuste",
        "venta",
        "anulacion",
        "compra",
      ],
    },
  },
} as const
