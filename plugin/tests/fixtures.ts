// Real envelopes captured from bin/bookshop (see scripts/fixtures.sh). Do not edit by hand.
export const search = {
  "v": 1,
  "ok": true,
  "actor": "user",
  "command": "search",
  "message": null,
  "result": null,
  "screen": {
    "page": "search",
    "href": "/search?query=gothic",
    "title": "Search: gothic",
    "status": "ok",
    "params": {
      "query": "gothic",
      "sort": "title",
      "page": 1
    },
    "data": {
      "total": 3,
      "pages": 1,
      "items": [
        {
          "id": "6",
          "title": "Dracula",
          "author": "Bram Stoker",
          "genre": "gothic",
          "price": 8.25,
          "stock": 6
        },
        {
          "id": "5",
          "title": "Frankenstein",
          "author": "Mary Shelley",
          "genre": "gothic",
          "price": 6.99,
          "stock": 9
        },
        {
          "id": "7",
          "title": "Wuthering Heights",
          "author": "Emily Brontë",
          "genre": "gothic",
          "price": 7.25,
          "stock": 5
        }
      ],
      "genres": [
        "adventure",
        "classic",
        "dystopia",
        "gothic",
        "romance",
        "sci-fi"
      ]
    },
    "model": null,
    "summary": "3 results for \"gothic\"",
    "view": {
      "type": "Stack",
      "props": {
        "gap": 1,
        "boundTo": "shell"
      },
      "children": [
        {
          "type": "Row",
          "props": {
            "boundTo": "shell"
          },
          "children": [
            {
              "type": "Text",
              "props": {
                "tone": "bold",
                "boundTo": "shell"
              },
              "children": [
                "Bookshop"
              ]
            },
            {
              "type": "Badge",
              "props": {
                "boundTo": "shell"
              },
              "children": [
                "cart empty"
              ]
            }
          ]
        },
        {
          "type": "Input",
          "props": {
            "param": "query",
            "label": "Search",
            "placeholder": "title, author or genre",
            "page": "search",
            "boundTo": "shell",
            "submit": {
              "argv": [
                "search",
                "--query"
              ],
              "template": "{value}"
            }
          },
          "children": []
        },
        {
          "type": "Divider",
          "props": {
            "boundTo": "shell"
          },
          "children": []
        },
        {
          "type": "Page",
          "props": {
            "title": "Results for \"gothic\"",
            "subtitle": "3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, sci-fi)",
            "boundTo": "search"
          },
          "children": [
            {
              "type": "Table",
              "props": {
                "columns": [
                  {
                    "key": "title",
                    "label": "title",
                    "align": "left"
                  },
                  {
                    "key": "author",
                    "label": "author",
                    "align": "left"
                  },
                  {
                    "key": "price",
                    "label": "price",
                    "align": "right"
                  },
                  {
                    "key": "stock",
                    "label": "",
                    "align": "left"
                  }
                ],
                "rows": [
                  {
                    "cells": [
                      "Dracula",
                      "Bram Stoker",
                      "£8.25",
                      ""
                    ],
                    "command": [
                      "open",
                      "1"
                    ]
                  },
                  {
                    "cells": [
                      "Frankenstein",
                      "Mary Shelley",
                      "£6.99",
                      ""
                    ],
                    "command": [
                      "open",
                      "2"
                    ]
                  },
                  {
                    "cells": [
                      "Wuthering Heights",
                      "Emily Brontë",
                      "£7.25",
                      ""
                    ],
                    "command": [
                      "open",
                      "3"
                    ]
                  }
                ],
                "rowIntent": "open",
                "empty": "No books match.",
                "boundTo": "search"
              },
              "children": []
            },
            {
              "type": "Row",
              "props": {
                "boundTo": "search"
              },
              "children": [
                {
                  "type": "Button",
                  "props": {
                    "intent": "prev",
                    "label": "Previous",
                    "hotkey": "p",
                    "boundTo": "search",
                    "command": [
                      "prev"
                    ],
                    "disabled": true,
                    "reason": "already on the first page"
                  },
                  "children": []
                },
                {
                  "type": "Text",
                  "props": {
                    "tone": "dim",
                    "boundTo": "search"
                  },
                  "children": [
                    "page 1 of 1"
                  ]
                },
                {
                  "type": "Button",
                  "props": {
                    "intent": "next",
                    "label": "Next",
                    "hotkey": "n",
                    "boundTo": "search",
                    "command": [
                      "next"
                    ],
                    "disabled": true,
                    "reason": "already on the last page"
                  },
                  "children": []
                }
              ]
            }
          ]
        }
      ]
    },
    "text": "Bookshop  [cart empty]\n\nSearch: title, author or genre▏ (search --query …)\n\n────────────────────────────────────────────────\n\nResults for \"gothic\"\n3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, sci-fi)\n\n   title              author        price\n1. Dracula            Bram Stoker   £8.25\n2. Frankenstein       Mary Shelley  £6.99\n3. Wuthering Heights  Emily Brontë  £7.25\n\n[p] Previous  page 1 of 1  [n] Next\n\nopen <row> · sort <by> · genre <name>",
    "intents": [
      {
        "name": "open",
        "page": "search",
        "usage": "open <row>",
        "description": "open the nth book on this page",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "row"
          ],
          "properties": {
            "row": {
              "minimum": 1,
              "type": "integer"
            }
          }
        },
        "available": true
      },
      {
        "name": "next",
        "page": "search",
        "usage": "next",
        "description": "next page of results",
        "kind": "navigate",
        "available": false,
        "reason": "already on the last page"
      },
      {
        "name": "prev",
        "page": "search",
        "usage": "prev",
        "description": "previous page of results",
        "kind": "navigate",
        "available": false,
        "reason": "already on the first page"
      },
      {
        "name": "sort",
        "page": "search",
        "usage": "sort <by>",
        "description": "sort by title, price or author",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "by"
          ],
          "properties": {
            "by": {
              "anyOf": [
                {
                  "const": "title",
                  "type": "string"
                },
                {
                  "const": "price",
                  "type": "string"
                },
                {
                  "const": "author",
                  "type": "string"
                }
              ]
            }
          }
        },
        "available": true
      },
      {
        "name": "genre",
        "page": "search",
        "usage": "genre <name>",
        "description": "filter by genre (\"all\" clears it)",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "type": "string"
            }
          }
        },
        "available": true
      }
    ],
    "controls": [
      {
        "kind": "input",
        "label": "Search",
        "submit": {
          "argv": [
            "search",
            "--query"
          ],
          "template": "{value}"
        }
      },
      {
        "kind": "row",
        "label": "Dracula · Bram Stoker · £8.25 · ",
        "command": [
          "open",
          "1"
        ]
      },
      {
        "kind": "row",
        "label": "Frankenstein · Mary Shelley · £6.99 · ",
        "command": [
          "open",
          "2"
        ]
      },
      {
        "kind": "row",
        "label": "Wuthering Heights · Emily Brontë · £7.25 · ",
        "command": [
          "open",
          "3"
        ]
      },
      {
        "kind": "button",
        "label": "Previous",
        "command": [
          "prev"
        ],
        "disabled": true,
        "reason": "already on the first page"
      },
      {
        "kind": "button",
        "label": "Next",
        "command": [
          "next"
        ],
        "disabled": true,
        "reason": "already on the last page"
      }
    ]
  },
  "pending": [],
  "error": null
} as const
export const withProposal = {
  "v": 1,
  "ok": true,
  "actor": "user",
  "command": "show",
  "message": null,
  "result": null,
  "screen": {
    "page": "search",
    "href": "/search?query=gothic",
    "title": "Search: gothic",
    "status": "ok",
    "params": {
      "query": "gothic",
      "sort": "title",
      "page": 1
    },
    "data": {
      "total": 3,
      "pages": 1,
      "items": [
        {
          "id": "6",
          "title": "Dracula",
          "author": "Bram Stoker",
          "genre": "gothic",
          "price": 8.25,
          "stock": 6
        },
        {
          "id": "5",
          "title": "Frankenstein",
          "author": "Mary Shelley",
          "genre": "gothic",
          "price": 6.99,
          "stock": 9
        },
        {
          "id": "7",
          "title": "Wuthering Heights",
          "author": "Emily Brontë",
          "genre": "gothic",
          "price": 7.25,
          "stock": 5
        }
      ],
      "genres": [
        "adventure",
        "classic",
        "dystopia",
        "gothic",
        "romance",
        "sci-fi"
      ]
    },
    "model": null,
    "summary": "3 results for \"gothic\"",
    "view": {
      "type": "Stack",
      "props": {
        "gap": 1,
        "boundTo": "shell"
      },
      "children": [
        {
          "type": "Row",
          "props": {
            "boundTo": "shell"
          },
          "children": [
            {
              "type": "Text",
              "props": {
                "tone": "bold",
                "boundTo": "shell"
              },
              "children": [
                "Bookshop"
              ]
            },
            {
              "type": "Badge",
              "props": {
                "boundTo": "shell"
              },
              "children": [
                "cart: 1"
              ]
            }
          ]
        },
        {
          "type": "Input",
          "props": {
            "param": "query",
            "label": "Search",
            "placeholder": "title, author or genre",
            "page": "search",
            "boundTo": "shell",
            "submit": {
              "argv": [
                "search",
                "--query"
              ],
              "template": "{value}"
            }
          },
          "children": []
        },
        {
          "type": "Divider",
          "props": {
            "boundTo": "shell"
          },
          "children": []
        },
        {
          "type": "Page",
          "props": {
            "title": "Results for \"gothic\"",
            "subtitle": "3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, sci-fi)",
            "boundTo": "search"
          },
          "children": [
            {
              "type": "Table",
              "props": {
                "columns": [
                  {
                    "key": "title",
                    "label": "title",
                    "align": "left"
                  },
                  {
                    "key": "author",
                    "label": "author",
                    "align": "left"
                  },
                  {
                    "key": "price",
                    "label": "price",
                    "align": "right"
                  },
                  {
                    "key": "stock",
                    "label": "",
                    "align": "left"
                  }
                ],
                "rows": [
                  {
                    "cells": [
                      "Dracula",
                      "Bram Stoker",
                      "£8.25",
                      ""
                    ],
                    "command": [
                      "open",
                      "1"
                    ]
                  },
                  {
                    "cells": [
                      "Frankenstein",
                      "Mary Shelley",
                      "£6.99",
                      ""
                    ],
                    "command": [
                      "open",
                      "2"
                    ]
                  },
                  {
                    "cells": [
                      "Wuthering Heights",
                      "Emily Brontë",
                      "£7.25",
                      ""
                    ],
                    "command": [
                      "open",
                      "3"
                    ]
                  }
                ],
                "rowIntent": "open",
                "empty": "No books match.",
                "boundTo": "search"
              },
              "children": []
            },
            {
              "type": "Row",
              "props": {
                "boundTo": "search"
              },
              "children": [
                {
                  "type": "Button",
                  "props": {
                    "intent": "prev",
                    "label": "Previous",
                    "hotkey": "p",
                    "boundTo": "search",
                    "command": [
                      "prev"
                    ],
                    "disabled": true,
                    "reason": "already on the first page"
                  },
                  "children": []
                },
                {
                  "type": "Text",
                  "props": {
                    "tone": "dim",
                    "boundTo": "search"
                  },
                  "children": [
                    "page 1 of 1"
                  ]
                },
                {
                  "type": "Button",
                  "props": {
                    "intent": "next",
                    "label": "Next",
                    "hotkey": "n",
                    "boundTo": "search",
                    "command": [
                      "next"
                    ],
                    "disabled": true,
                    "reason": "already on the last page"
                  },
                  "children": []
                }
              ]
            }
          ]
        }
      ]
    },
    "text": "Bookshop  [cart: 1]\n\nSearch: title, author or genre▏ (search --query …)\n\n────────────────────────────────────────────────\n\nResults for \"gothic\"\n3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, sci-fi)\n\n   title              author        price\n1. Dracula            Bram Stoker   £8.25\n2. Frankenstein       Mary Shelley  £6.99\n3. Wuthering Heights  Emily Brontë  £7.25\n\n[p] Previous  page 1 of 1  [n] Next\n\nopen <row> · sort <by> · genre <name>",
    "intents": [
      {
        "name": "open",
        "page": "search",
        "usage": "open <row>",
        "description": "open the nth book on this page",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "row"
          ],
          "properties": {
            "row": {
              "minimum": 1,
              "type": "integer"
            }
          }
        },
        "available": true
      },
      {
        "name": "next",
        "page": "search",
        "usage": "next",
        "description": "next page of results",
        "kind": "navigate",
        "available": false,
        "reason": "already on the last page"
      },
      {
        "name": "prev",
        "page": "search",
        "usage": "prev",
        "description": "previous page of results",
        "kind": "navigate",
        "available": false,
        "reason": "already on the first page"
      },
      {
        "name": "sort",
        "page": "search",
        "usage": "sort <by>",
        "description": "sort by title, price or author",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "by"
          ],
          "properties": {
            "by": {
              "anyOf": [
                {
                  "const": "title",
                  "type": "string"
                },
                {
                  "const": "price",
                  "type": "string"
                },
                {
                  "const": "author",
                  "type": "string"
                }
              ]
            }
          }
        },
        "available": true
      },
      {
        "name": "genre",
        "page": "search",
        "usage": "genre <name>",
        "description": "filter by genre (\"all\" clears it)",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "type": "string"
            }
          }
        },
        "available": true
      }
    ],
    "controls": [
      {
        "kind": "input",
        "label": "Search",
        "submit": {
          "argv": [
            "search",
            "--query"
          ],
          "template": "{value}"
        }
      },
      {
        "kind": "row",
        "label": "Dracula · Bram Stoker · £8.25 · ",
        "command": [
          "open",
          "1"
        ]
      },
      {
        "kind": "row",
        "label": "Frankenstein · Mary Shelley · £6.99 · ",
        "command": [
          "open",
          "2"
        ]
      },
      {
        "kind": "row",
        "label": "Wuthering Heights · Emily Brontë · £7.25 · ",
        "command": [
          "open",
          "3"
        ]
      },
      {
        "kind": "button",
        "label": "Previous",
        "command": [
          "prev"
        ],
        "disabled": true,
        "reason": "already on the first page"
      },
      {
        "kind": "button",
        "label": "Next",
        "command": [
          "next"
        ],
        "disabled": true,
        "reason": "already on the last page"
      }
    ]
  },
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T16:46:58.940Z",
      "actor": "agent",
      "sid": "ad8890ad",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "error": null
} as const
export const open = {
  "v": 1,
  "ok": true,
  "actor": "user",
  "command": "open",
  "message": null,
  "result": null,
  "screen": {
    "page": "book",
    "href": "/books/5",
    "title": "Frankenstein",
    "status": "ok",
    "params": {
      "id": "5"
    },
    "data": {
      "id": "5",
      "title": "Frankenstein",
      "author": "Mary Shelley",
      "genre": "gothic",
      "price": 6.99,
      "stock": 9
    },
    "model": {
      "inStock": true,
      "lowStock": false
    },
    "summary": "Frankenstein, £6.99",
    "view": {
      "type": "Stack",
      "props": {
        "gap": 1,
        "boundTo": "shell"
      },
      "children": [
        {
          "type": "Row",
          "props": {
            "boundTo": "shell"
          },
          "children": [
            {
              "type": "Text",
              "props": {
                "tone": "bold",
                "boundTo": "shell"
              },
              "children": [
                "Bookshop"
              ]
            },
            {
              "type": "Badge",
              "props": {
                "boundTo": "shell"
              },
              "children": [
                "cart: 1"
              ]
            }
          ]
        },
        {
          "type": "Input",
          "props": {
            "param": "query",
            "label": "Search",
            "placeholder": "title, author or genre",
            "page": "search",
            "boundTo": "shell",
            "submit": {
              "argv": [
                "search",
                "--query"
              ],
              "template": "{value}"
            }
          },
          "children": []
        },
        {
          "type": "Divider",
          "props": {
            "boundTo": "shell"
          },
          "children": []
        },
        {
          "type": "Page",
          "props": {
            "title": "Frankenstein",
            "subtitle": "by Mary Shelley",
            "boundTo": "book"
          },
          "children": [
            {
              "type": "KeyValue",
              "props": {
                "items": [
                  [
                    "Genre",
                    "gothic"
                  ],
                  [
                    "Price",
                    "£6.99"
                  ],
                  [
                    "Stock",
                    "9"
                  ]
                ],
                "boundTo": "book"
              },
              "children": []
            },
            {
              "type": "Row",
              "props": {
                "boundTo": "book"
              },
              "children": [
                {
                  "type": "Button",
                  "props": {
                    "intent": "add",
                    "label": "Add to cart",
                    "hotkey": "a",
                    "boundTo": "book",
                    "command": [
                      "add"
                    ]
                  },
                  "children": []
                },
                {
                  "type": "Button",
                  "props": {
                    "intent": "more",
                    "label": "More gothic",
                    "hotkey": "m",
                    "boundTo": "book",
                    "command": [
                      "more"
                    ]
                  },
                  "children": []
                },
                {
                  "type": "Link",
                  "props": {
                    "href": "/search",
                    "page": "search",
                    "boundTo": "book",
                    "command": [
                      "go",
                      "/search"
                    ]
                  },
                  "children": [
                    "All books"
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "text": "Bookshop  [cart: 1]\n\nSearch: title, author or genre▏ (search --query …)\n\n────────────────────────────────────────────────\n\nFrankenstein\nby Mary Shelley\n\nGenre  gothic\nPrice  £6.99\nStock  9\n\n[a] Add to cart  [m] More gothic  All books\n\nadd [qty] · more",
    "intents": [
      {
        "name": "add",
        "page": "book",
        "usage": "add [qty]",
        "description": "add this book to the cart",
        "kind": "action",
        "action": "cart.add",
        "args": {
          "type": "object",
          "required": [
            "qty"
          ],
          "properties": {
            "qty": {
              "minimum": 1,
              "default": 1,
              "type": "integer"
            }
          }
        },
        "available": true
      },
      {
        "name": "more",
        "page": "book",
        "usage": "more",
        "description": "more books in this genre",
        "kind": "navigate",
        "available": true
      }
    ],
    "controls": [
      {
        "kind": "input",
        "label": "Search",
        "submit": {
          "argv": [
            "search",
            "--query"
          ],
          "template": "{value}"
        }
      },
      {
        "kind": "button",
        "label": "Add to cart",
        "command": [
          "add"
        ]
      },
      {
        "kind": "button",
        "label": "More gothic",
        "command": [
          "more"
        ]
      },
      {
        "kind": "link",
        "label": "All books",
        "command": [
          "go",
          "/search"
        ]
      }
    ]
  },
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T16:46:58.940Z",
      "actor": "agent",
      "sid": "ad8890ad",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "error": null
} as const
export const logTail = {
  "v": 1,
  "ok": true,
  "actor": "user",
  "command": "log",
  "message": "#5 16:46:58 agent  ⚑ proposes order.place (checkout)",
  "result": [
    {
      "id": 5,
      "at": "2026-10-20T16:46:58.940Z",
      "actor": "agent",
      "sid": "ad8890ad",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T16:46:58.940Z",
      "actor": "agent",
      "sid": "ad8890ad",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "error": null
} as const
export const logSince = {
  "v": 1,
  "ok": true,
  "actor": "user",
  "command": "log",
  "message": "#2 16:46:58 agent  → book {\"id\":\"4\"} · Jane Eyre, £7.50\n#3 16:46:58 agent  ✓ cart.add {\"bookId\":\"4\",\"qty\":1} (add) · added 1 × Jane Eyre\n#4 16:46:58 agent  → cart · 1 item(s), £11.49\n#5 16:46:58 agent  ⚑ proposes order.place (checkout)",
  "result": [
    {
      "id": 2,
      "at": "2026-10-20T16:46:58.444Z",
      "actor": "agent",
      "sid": "da3c1d34",
      "kind": "visit",
      "page": "book",
      "params": {
        "id": "4"
      },
      "href": "/books/4",
      "nav": "PUSH",
      "note": "Jane Eyre, £7.50"
    },
    {
      "id": 3,
      "at": "2026-10-20T16:46:58.607Z",
      "actor": "agent",
      "sid": "d22fe356",
      "kind": "apply",
      "page": "book",
      "intent": "add",
      "action": "cart.add",
      "input": {
        "bookId": "4",
        "qty": 1
      },
      "result": {
        "bookId": "4",
        "title": "Jane Eyre",
        "qty": 1
      },
      "note": "added 1 × Jane Eyre"
    },
    {
      "id": 4,
      "at": "2026-10-20T16:46:58.783Z",
      "actor": "agent",
      "sid": "bc2cadf3",
      "kind": "visit",
      "page": "cart",
      "params": {},
      "href": "/cart",
      "nav": "PUSH",
      "note": "1 item(s), £11.49"
    },
    {
      "id": 5,
      "at": "2026-10-20T16:46:58.940Z",
      "actor": "agent",
      "sid": "ad8890ad",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T16:46:58.940Z",
      "actor": "agent",
      "sid": "ad8890ad",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "error": null
} as const
export const logUser = {
  "v": 1,
  "ok": true,
  "actor": "user",
  "command": "log",
  "message": "#1 16:46:58 user   → search {\"query\":\"gothic\",\"sort\":\"title\",\"page\":1} · 3 results for \"gothic\"\n#6 16:46:59 user   → book {\"id\":\"5\"} (open) · Frankenstein, £6.99",
  "result": [
    {
      "id": 1,
      "at": "2026-10-20T16:46:58.254Z",
      "actor": "user",
      "sid": "5879abef",
      "kind": "visit",
      "page": "search",
      "params": {
        "query": "gothic",
        "sort": "title",
        "page": 1
      },
      "href": "/search?query=gothic",
      "nav": "PUSH",
      "note": "3 results for \"gothic\""
    },
    {
      "id": 6,
      "at": "2026-10-20T16:46:59.685Z",
      "actor": "user",
      "sid": "29730239",
      "kind": "visit",
      "page": "book",
      "params": {
        "id": "5"
      },
      "href": "/books/5",
      "nav": "PUSH",
      "intent": "open",
      "note": "Frankenstein, £6.99"
    }
  ],
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T16:46:58.940Z",
      "actor": "agent",
      "sid": "ad8890ad",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "error": null
} as const
