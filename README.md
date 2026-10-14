# Obsidian

플러그인마다 폴더가 나뉘어 있습니다. 옵시디언은 `<볼트>/.obsidian/plugins/<플러그인 id>/`를 읽고, 그 안의 `manifest.json`에 있는 `id`가 다르면 서로 다른 플러그인으로 인식합니다.

| 폴더 | id | 이름 |
| --- | --- | --- |
| `subscription-shelf/` | `subscription-shelf` | 구독함 |
| `purchase-wishlist/` | `purchase-wishlist` | 구매 위시리스트 |
| `household-ledger/` | `household-ledger` | 가계부 |

볼트에서 쓰려면 각 폴더를 `.obsidian/plugins/` 아래로 복사한 뒤, 설정 → 커뮤니티 플러그인에서 각각 켜면 됩니다.

- `subscription-shelf/` → `<볼트>/.obsidian/plugins/subscription-shelf/`
- `purchase-wishlist/` → `<볼트>/.obsidian/plugins/purchase-wishlist/`
- `household-ledger/` → `<볼트>/.obsidian/plugins/household-ledger/`
