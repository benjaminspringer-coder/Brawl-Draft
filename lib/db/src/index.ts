import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    db = drizzle(pool, { schema });
  } catch (err) {
    console.warn("[AI Studio DB] Failed to create PostgreSQL pool:", err);
  }
}

if (!db) {
  console.warn("[AI Studio DB] DATABASE_URL is not set or unavailable — using in-memory mock store fallback.");

  const globalStores: Map<string, any[]> = (globalThis as any).__ai_studio_db_stores__ || new Map<string, any[]>();
  (globalThis as any).__ai_studio_db_stores__ = globalStores;

  const getTableName = (table: any): string => {
    if (typeof table === "string") return table;
    if (!table) return "default";
    return (
      table[Symbol.for("drizzle:Name")] ??
      table[Symbol.for("drizzle:BaseName")] ??
      table?._?.name ??
      table?.name ??
      "default"
    );
  };

  const getStore = (table: any): any[] => {
    const name = getTableName(table);
    if (!globalStores.has(name)) {
      globalStores.set(name, []);
    }
    return globalStores.get(name)!;
  };

  const findUniqueKey = (item: any) => {
    if (item.scrimId !== undefined) return { key: "scrimId", val: item.scrimId };
    if (item.externalMatchId !== undefined) return { key: "externalMatchId", val: item.externalMatchId };
    if (item.slug !== undefined) return { key: "slug", val: item.slug };
    if (item.id !== undefined) return { key: "id", val: item.id };
    return null;
  };

  const createQueryChain = (initialTargetTable: any = null) => {
    let currentTable = initialTargetTable;
    let limitVal: number | null = null;
    let whereFilter: ((item: any) => boolean) | null = null;

    const getTargetStore = () => getStore(currentTable);

    const chain: any = {
      from: (table: any) => {
        currentTable = table;
        return chain;
      },
      where: (clause: any) => {
        return chain;
      },
      orderBy: (...args: any[]) => chain,
      limit: (l: number) => {
        limitVal = l;
        return chain;
      },
      innerJoin: () => chain,
      leftJoin: () => chain,
      offset: () => chain,
      set: (updates: any) => chain,
      values: (val: any) => {
        const store = getTargetStore();
        const items = Array.isArray(val) ? val : [val];
        const insertedList: any[] = [];

        for (const inputItem of items) {
          const uKey = findUniqueKey(inputItem);
          let existingIndex = -1;
          if (uKey) {
            existingIndex = store.findIndex((r) => r[uKey.key] === uKey.val);
          }

          if (existingIndex >= 0) {
            const updated = {
              ...store[existingIndex],
              ...inputItem,
              updatedAt: new Date(),
            };
            store[existingIndex] = updated;
            insertedList.push(updated);
          } else {
            const inserted = {
              id: inputItem.id ?? store.length + 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...inputItem,
            };
            store.push(inserted);
            insertedList.push(inserted);
          }
        }

        const res = insertedList;
        return {
          returning: () => res,
          onConflictDoUpdate: ({ set }: any = {}) => {
            if (set) {
              for (const item of res) {
                Object.assign(item, set);
              }
            }
            return {
              returning: () => res,
              then: (resolve: any) => resolve(res),
            };
          },
          then: (resolve: any) => resolve(res),
        };
      },
      returning: () => {
        const store = getTargetStore();
        return limitVal ? store.slice(0, limitVal) : [...store];
      },
      onConflictDoUpdate: () => chain,
      then: (resolve: any) => {
        let store = getTargetStore();
        if (limitVal) store = store.slice(0, limitVal);
        return resolve([...store]);
      },
    };
    return chain;
  };

  db = {
    execute: async (query: any) => {
      const scrimsStore = globalStores.get("scrims") ?? [];
      const rows = scrimsStore.map((s) => ({
        id: s.id,
        scrim_id: s.scrimId,
        time: s.time,
        mode: s.mode,
        map: s.map,
        duration: s.duration,
        scoreline: s.scoreline,
        winner_team_code: s.winnerTeamCode,
        is_tournament: s.isTournament,
        team1_code: s.team1Code,
        team1_name: s.team1Name,
        team2_code: s.team2Code,
        team2_name: s.team2Name,
        team1_players: s.team1Players,
        team2_players: s.team2Players,
        mvp_player: s.mvpPlayer,
        mvp_team: s.mvpTeam,
        created_at: s.createdAt,
      }));
      return { rows };
    },
    select: (args?: any) => createQueryChain(),
    selectDistinct: (args?: any) => createQueryChain(),
    insert: (table: any) => createQueryChain(table),
    update: (table: any) => createQueryChain(table),
    delete: (table: any) => createQueryChain(table),
    query: new Proxy({}, { get: () => createQueryChain() }),
  };
}

export { pool, db };
export * from "./schema";
