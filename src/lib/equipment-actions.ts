export async function setEquipmentStatus(
  id: string,
  status: "ACTIVE" | "RETIRED"
): Promise<void> {
  const res = await fetch(`/api/equipment/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update item status");
  }
}
