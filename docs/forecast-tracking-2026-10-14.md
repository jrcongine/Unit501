# Pregame forecast and selected-pick tracking

The previous archive saved only injury/lineup-adjusted team scores and props with changed lineup/workload. Ordinary forecasts were omitted, so saved accuracy could not represent routine use.

The archive now saves the first eligible game simulation and ordinary player forecasts shown on cards or generated for line comparisons. It still requires a valid upcoming game within seven days. It does not generate the whole slate in the background. Later renders and edits preserve the original snapshot. Existing forecasts remain intact; past unsaved predictions cannot be reconstructed honestly.

Game snapshots retain the spread, total and available FanDuel quote metadata. Player snapshots retain the current line, available over/under prices, quote timestamp, player name, model version and model inputs. A line absent at the first forecast stays absent in that snapshot. Missing prices stay unknown. This changes tracking, not projection formulas.

Use **Save selected pick** to freeze a separate pregame selection, its direction, line, optional American price and forecast. Game picks use the latest valid simulation; changing inputs invalidates it. Player picks use the current eligible projection. The first selection per game market or player/stat stays fixed, including its direction, to prevent changing the record after results. This is a research selection log, not a wager ledger: additional tickets, hedges, parlays, stakes and bookmaker settlement are not modeled.

The existing final-results matcher handles both types. Selected picks display wins/losses/pushes by final statistic, with missing outcomes pending. Bookmaker participation/void rules require separate review. The all-forecast accuracy table and offline comparison exclude selection copies to avoid double counting. Download/restore includes both forecasts and selections, with validation and first-record preservation.

Storage remains browser-local, with explicit write failures and download/restore for transfer. No cross-device synchronization or server archive is introduced. Recorded device timestamps are not independent proof of pregame capture. The archive UI and data do not establish betting profitability or automatically tune the model.

Validation includes ordinary forecast capture, immutable first predictions, selected line/price freezing, post-kickoff rejection, import validation, missing/zero results, home/away spread conventions, and matching general/selected snapshots that share timestamps. Client-flow tests run actual scripts in a DOM harness; they do not verify visual rendering or live provider coverage.
