export type TttCell = "X" | "O" | "";
export type TttBoard = TttCell[][];
export type TttWinner = "X" | "O" | "DRAW" | null;

export type TttMove = {
  row: number;
  col: number;
};

export function createEmptyBoard(): TttBoard {
  return [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ];
}

export function validateMove(board: TttBoard, row: number, col: number): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  if (row < 0 || row > 2 || col < 0 || col > 2) return false;
  return board[row]?.[col] === "";
}

export function checkWinner(board: TttBoard): TttWinner {
  const lines: TttCell[][] = [
    [board[0][0], board[0][1], board[0][2]],
    [board[1][0], board[1][1], board[1][2]],
    [board[2][0], board[2][1], board[2][2]],
    [board[0][0], board[1][0], board[2][0]],
    [board[0][1], board[1][1], board[2][1]],
    [board[0][2], board[1][2], board[2][2]],
    [board[0][0], board[1][1], board[2][2]],
    [board[0][2], board[1][1], board[2][0]],
  ];

  for (const line of lines) {
    if (line[0] !== "" && line[0] === line[1] && line[1] === line[2]) {
      return line[0];
    }
  }

  const hasEmpty = board.some((row) => row.some((cell) => cell === ""));
  return hasEmpty ? null : "DRAW";
}

export function getAvailableMoves(board: TttBoard): TttMove[] {
  const moves: TttMove[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (board[row][col] === "") {
        moves.push({ row, col });
      }
    }
  }
  return moves;
}
