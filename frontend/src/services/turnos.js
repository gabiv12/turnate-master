// src/services/turnos.js
import api from "./api";

export async function getMisTurnos(desdeISO, hastaISO) {
  const { data } = await api.get("/turnos/mis", {
    params: { desde: desdeISO, hasta: hastaISO },
  });
  return data;
}
