import { queryOptions } from "@tanstack/react-query";
import { getPackages } from "./payments.functions";

export const licensingOptions = queryOptions({
  queryKey: ["institutional", "packages"],
  queryFn: () => getPackages(),
  staleTime: 10000,
  refetchInterval: 15000,
});
