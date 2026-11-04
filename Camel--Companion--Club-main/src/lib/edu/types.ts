export type StudentRecord = {
  estudiante_id: string;
  grupo: string;
  asistencia: number; // % 0-100
  nota_media: number; // 0-10
  tareas_entregadas: number; // % 0-100
};

export type Level = "verde" | "amarillo" | "rojo";

export type Alert = {
  estudiante_id: string;
  grupo: string;
  level: Level;
  reasons: string[];
  factors: {
    metric: "asistencia" | "nota_media" | "tareas_entregadas";
    value: number;
    threshold: number;
    unit: string;
  }[];
};

export type PlanStatus = "pendiente" | "en_curso" | "completado" | "descartado";

export type InterventionPlan = {
  id: string;
  titulo: string;
  grupo: string;
  responsable: string;
  accion: string;
  estado: PlanStatus;
  revisado: boolean;
  creado: string;
};
