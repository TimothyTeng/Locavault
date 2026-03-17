export type BlockStyle = { bg: string; border: string; label: string };

export type BlockDetails = {
    block_id:string;
    background: string;
    border: string;
    label: string;
    height: number;
    width: number;
    x: number;
    y: number;};
export type CreateStoreInput = {
  id: string;
  name: string;
  userId: string;
  tags?: string;
  description?: string;
  rows: number;
  cols: number;
  blocks: BlockDetails[];
};