/** A content-owned graph. The engine handles transitions, validation, and replay. */
export interface MissionNode<Id extends string = string> {
  id: Id;
  on: Record<string, Id>;
  terminal?: boolean;
}
export class MissionGraph<Id extends string = string> {
  readonly nodes: Map<Id, MissionNode<Id>>;
  constructor(nodes: readonly MissionNode<Id>[]) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    if (this.nodes.size !== nodes.length)
      throw new Error("Mission node ids must be unique.");
    for (const node of nodes)
      for (const target of Object.values(node.on))
        if (!this.nodes.has(target))
          throw new Error(`Unknown mission node: ${target}`);
  }
  transition(current: Id, signal: string): Id | null {
    return this.nodes.get(current)?.on[signal] ?? null;
  }
  accepts(current: Id, signal: string) {
    return this.transition(current, signal) !== null;
  }
}
