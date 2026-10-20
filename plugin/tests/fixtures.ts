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
          "slug": "dracula",
          "title": "Dracula",
          "author": "Bram Stoker",
          "genre": "gothic",
          "price": 8.25,
          "stock": 6
        },
        {
          "id": "5",
          "slug": "frankenstein",
          "title": "Frankenstein",
          "author": "Mary Shelley",
          "genre": "gothic",
          "price": 6.99,
          "stock": 9
        },
        {
          "id": "7",
          "slug": "wuthering-heights",
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
        "science"
      ]
    },
    "model": null,
    "summary": "3 results for \"gothic\"",
    "view": {
      "type": "Scope",
      "props": {
        "page": "shell"
      },
      "children": [
        {
          "type": "Stack",
          "props": {
            "gap": 1
          },
          "children": [
            {
              "type": "Row",
              "props": {},
              "children": [
                {
                  "type": "Text",
                  "props": {
                    "tone": "bold"
                  },
                  "children": [
                    "Bookshop"
                  ]
                },
                {
                  "type": "Badge",
                  "props": {},
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
              "props": {},
              "children": []
            },
            {
              "type": "Scope",
              "props": {
                "page": "search"
              },
              "children": [
                {
                  "type": "Page",
                  "props": {
                    "title": "Results for \"gothic\"",
                    "subtitle": "3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, science)"
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
                        "empty": "No books match."
                      },
                      "children": []
                    },
                    {
                      "type": "Row",
                      "props": {},
                      "children": [
                        {
                          "type": "Button",
                          "props": {
                            "intent": "prev",
                            "label": "Previous",
                            "hotkey": "p",
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
                            "tone": "dim"
                          },
                          "children": [
                            "page ",
                            "1",
                            " of ",
                            "1"
                          ]
                        },
                        {
                          "type": "Button",
                          "props": {
                            "intent": "next",
                            "label": "Next",
                            "hotkey": "n",
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
            }
          ]
        }
      ]
    },
    "text": "Bookshop  [cart empty]\n\nSearch: title, author or genre▏ (search --query …)\n\n────────────────────────────────────────────────\n\nResults for \"gothic\"\n3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, science)\n\n   title              author        price\n1. Dracula            Bram Stoker   £8.25\n2. Frankenstein       Mary Shelley  £6.99\n3. Wuthering Heights  Emily Brontë  £7.25\n\n[p] Previous  page 1 of 1  [n] Next\n\nopen <row> · sort <by> · genre <name>",
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
          "slug": "dracula",
          "title": "Dracula",
          "author": "Bram Stoker",
          "genre": "gothic",
          "price": 8.25,
          "stock": 6
        },
        {
          "id": "5",
          "slug": "frankenstein",
          "title": "Frankenstein",
          "author": "Mary Shelley",
          "genre": "gothic",
          "price": 6.99,
          "stock": 9
        },
        {
          "id": "7",
          "slug": "wuthering-heights",
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
        "science"
      ]
    },
    "model": null,
    "summary": "3 results for \"gothic\"",
    "view": {
      "type": "Scope",
      "props": {
        "page": "shell"
      },
      "children": [
        {
          "type": "Stack",
          "props": {
            "gap": 1
          },
          "children": [
            {
              "type": "Row",
              "props": {},
              "children": [
                {
                  "type": "Text",
                  "props": {
                    "tone": "bold"
                  },
                  "children": [
                    "Bookshop"
                  ]
                },
                {
                  "type": "Badge",
                  "props": {},
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
              "props": {},
              "children": []
            },
            {
              "type": "Scope",
              "props": {
                "page": "search"
              },
              "children": [
                {
                  "type": "Page",
                  "props": {
                    "title": "Results for \"gothic\"",
                    "subtitle": "3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, science)"
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
                        "empty": "No books match."
                      },
                      "children": []
                    },
                    {
                      "type": "Row",
                      "props": {},
                      "children": [
                        {
                          "type": "Button",
                          "props": {
                            "intent": "prev",
                            "label": "Previous",
                            "hotkey": "p",
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
                            "tone": "dim"
                          },
                          "children": [
                            "page ",
                            "1",
                            " of ",
                            "1"
                          ]
                        },
                        {
                          "type": "Button",
                          "props": {
                            "intent": "next",
                            "label": "Next",
                            "hotkey": "n",
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
            }
          ]
        }
      ]
    },
    "text": "Bookshop  [cart: 1]\n\nSearch: title, author or genre▏ (search --query …)\n\n────────────────────────────────────────────────\n\nResults for \"gothic\"\n3 book(s) · sorted by title · genre: all (adventure, classic, dystopia, gothic, romance, science)\n\n   title              author        price\n1. Dracula            Bram Stoker   £8.25\n2. Frankenstein       Mary Shelley  £6.99\n3. Wuthering Heights  Emily Brontë  £7.25\n\n[p] Previous  page 1 of 1  [n] Next\n\nopen <row> · sort <by> · genre <name>",
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
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
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
    "page": "details",
    "href": "/books/gothic/frankenstein",
    "title": "Frankenstein",
    "status": "ok",
    "params": {
      "genre": "gothic",
      "slug": "frankenstein"
    },
    "data": null,
    "model": null,
    "summary": "Frankenstein, £6.99",
    "view": {
      "type": "Scope",
      "props": {
        "page": "shell"
      },
      "children": [
        {
          "type": "Stack",
          "props": {
            "gap": 1
          },
          "children": [
            {
              "type": "Row",
              "props": {},
              "children": [
                {
                  "type": "Text",
                  "props": {
                    "tone": "bold"
                  },
                  "children": [
                    "Bookshop"
                  ]
                },
                {
                  "type": "Badge",
                  "props": {},
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
              "props": {},
              "children": []
            },
            {
              "type": "Scope",
              "props": {
                "page": "shelf"
              },
              "children": [
                {
                  "type": "Page",
                  "props": {
                    "title": "Shelf: gothic",
                    "subtitle": "3 books"
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
                          }
                        ],
                        "rows": [
                          {
                            "cells": [
                              "Dracula",
                              "Bram Stoker",
                              "£8.25"
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
                              "£6.99"
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
                              "£7.25"
                            ],
                            "command": [
                              "open",
                              "3"
                            ]
                          }
                        ],
                        "rowIntent": "open"
                      },
                      "children": []
                    },
                    {
                      "type": "Scope",
                      "props": {
                        "page": "book"
                      },
                      "children": [
                        {
                          "type": "Section",
                          "props": {
                            "title": "Frankenstein"
                          },
                          "children": [
                            {
                              "type": "Row",
                              "props": {},
                              "children": [
                                {
                                  "type": "Text",
                                  "props": {
                                    "tone": "dim"
                                  },
                                  "children": [
                                    "by ",
                                    "Mary Shelley",
                                    " · ",
                                    "£6.99"
                                  ]
                                }
                              ]
                            },
                            {
                              "type": "Row",
                              "props": {},
                              "children": [
                                {
                                  "type": "Button",
                                  "props": {
                                    "intent": "add",
                                    "label": "Add to cart",
                                    "hotkey": "a",
                                    "command": [
                                      "add"
                                    ]
                                  },
                                  "children": []
                                },
                                {
                                  "type": "Button",
                                  "props": {
                                    "intent": "close",
                                    "label": "Close",
                                    "hotkey": "x",
                                    "command": [
                                      "close"
                                    ]
                                  },
                                  "children": []
                                }
                              ]
                            },
                            {
                              "type": "Tabs",
                              "props": {
                                "tabs": [
                                  {
                                    "key": "details",
                                    "label": "Details",
                                    "active": true,
                                    "command": [
                                      "tab",
                                      "details"
                                    ]
                                  },
                                  {
                                    "key": "reviews",
                                    "label": "Reviews",
                                    "active": false,
                                    "command": [
                                      "tab",
                                      "reviews"
                                    ]
                                  }
                                ]
                              },
                              "children": [
                                {
                                  "type": "Scope",
                                  "props": {
                                    "page": "details"
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
                                        ]
                                      },
                                      "children": []
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "text": "Bookshop  [cart: 1]\n\nSearch: title, author or genre▏ (search --query …)\n\n────────────────────────────────────────────────\n\nShelf: gothic\n3 books\n\n   title              author        price\n1. Dracula            Bram Stoker   £8.25\n2. Frankenstein       Mary Shelley  £6.99\n3. Wuthering Heights  Emily Brontë  £7.25\n\nFrankenstein\nby Mary Shelley · £6.99\n[a] Add to cart  [x] Close\n[1 Details]  2 Reviews \n────────────────────────────────────────────────\nGenre  gothic\nPrice  £6.99\nStock  9\n\nadd [qty] · close · tab <name> · open <row>",
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
        "name": "close",
        "page": "book",
        "usage": "close",
        "description": "back to the shelf",
        "kind": "navigate",
        "available": true
      },
      {
        "name": "tab",
        "page": "book",
        "usage": "tab <name>",
        "description": "switch tab: details, reviews",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "description": "details | reviews",
              "type": "string"
            }
          }
        },
        "available": true
      },
      {
        "name": "open",
        "page": "shelf",
        "usage": "open <row>",
        "description": "open the nth book on this shelf",
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
        "label": "Dracula · Bram Stoker · £8.25",
        "command": [
          "open",
          "1"
        ]
      },
      {
        "kind": "row",
        "label": "Frankenstein · Mary Shelley · £6.99",
        "command": [
          "open",
          "2"
        ]
      },
      {
        "kind": "row",
        "label": "Wuthering Heights · Emily Brontë · £7.25",
        "command": [
          "open",
          "3"
        ]
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
        "label": "Close",
        "command": [
          "close"
        ]
      },
      {
        "kind": "tab",
        "label": "Details (active)",
        "command": [
          "tab",
          "details"
        ]
      },
      {
        "kind": "tab",
        "label": "Reviews",
        "command": [
          "tab",
          "reviews"
        ]
      }
    ]
  },
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
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
  "message": "#5 17:31:01 agent  ⚑ proposes order.place (checkout)",
  "result": [
    {
      "id": 5,
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
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
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
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
  "message": "#2 17:31:00 agent  → details {\"genre\":\"gothic\",\"slug\":\"dracula\"} · Dracula, £8.25\n#3 17:31:00 agent  ✓ cart.add {\"bookId\":\"6\",\"qty\":1} (add) · added 1 × Dracula\n#4 17:31:00 agent  → cart · 1 item(s), £12.24\n#5 17:31:01 agent  ⚑ proposes order.place (checkout)",
  "result": [
    {
      "id": 2,
      "at": "2026-10-20T17:31:00.566Z",
      "actor": "agent",
      "sid": "d84a9283",
      "kind": "visit",
      "page": "details",
      "params": {
        "genre": "gothic",
        "slug": "dracula"
      },
      "href": "/books/gothic/dracula",
      "nav": "PUSH",
      "note": "Dracula, £8.25"
    },
    {
      "id": 3,
      "at": "2026-10-20T17:31:00.780Z",
      "actor": "agent",
      "sid": "bdc0d95c",
      "kind": "apply",
      "page": "book",
      "intent": "add",
      "action": "cart.add",
      "input": {
        "bookId": "6",
        "qty": 1
      },
      "result": {
        "bookId": "6",
        "title": "Dracula",
        "qty": 1
      },
      "note": "added 1 × Dracula"
    },
    {
      "id": 4,
      "at": "2026-10-20T17:31:00.976Z",
      "actor": "agent",
      "sid": "77b63e92",
      "kind": "visit",
      "page": "cart",
      "params": {},
      "href": "/cart",
      "nav": "PUSH",
      "note": "1 item(s), £12.24"
    },
    {
      "id": 5,
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
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
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
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
  "message": "#1 17:31:00 user   → search {\"query\":\"gothic\",\"sort\":\"title\",\"page\":1} · 3 results for \"gothic\"\n#6 17:31:02 user   → details {\"genre\":\"gothic\",\"slug\":\"frankenstein\"} (open) · Frankenstein, £6.99",
  "result": [
    {
      "id": 1,
      "at": "2026-10-20T17:31:00.350Z",
      "actor": "user",
      "sid": "132d9624",
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
      "at": "2026-10-20T17:31:02.103Z",
      "actor": "user",
      "sid": "8fc9d8d6",
      "kind": "visit",
      "page": "details",
      "params": {
        "genre": "gothic",
        "slug": "frankenstein"
      },
      "href": "/books/gothic/frankenstein",
      "nav": "PUSH",
      "intent": "open",
      "note": "Frankenstein, £6.99"
    }
  ],
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "error": null
} as const
export const book = {
  "v": 1,
  "ok": true,
  "actor": "user",
  "command": "book",
  "message": null,
  "result": null,
  "screen": {
    "page": "details",
    "href": "/books/gothic/frankenstein",
    "title": "Frankenstein",
    "status": "ok",
    "params": {
      "genre": "gothic",
      "slug": "frankenstein"
    },
    "data": null,
    "model": null,
    "summary": "Frankenstein, £6.99",
    "view": {
      "type": "Scope",
      "props": {
        "page": "shell"
      },
      "children": [
        {
          "type": "Stack",
          "props": {
            "gap": 1
          },
          "children": [
            {
              "type": "Row",
              "props": {},
              "children": [
                {
                  "type": "Text",
                  "props": {
                    "tone": "bold"
                  },
                  "children": [
                    "Bookshop"
                  ]
                },
                {
                  "type": "Badge",
                  "props": {},
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
              "props": {},
              "children": []
            },
            {
              "type": "Scope",
              "props": {
                "page": "shelf"
              },
              "children": [
                {
                  "type": "Page",
                  "props": {
                    "title": "Shelf: gothic",
                    "subtitle": "3 books"
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
                          }
                        ],
                        "rows": [
                          {
                            "cells": [
                              "Dracula",
                              "Bram Stoker",
                              "£8.25"
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
                              "£6.99"
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
                              "£7.25"
                            ],
                            "command": [
                              "open",
                              "3"
                            ]
                          }
                        ],
                        "rowIntent": "open"
                      },
                      "children": []
                    },
                    {
                      "type": "Scope",
                      "props": {
                        "page": "book"
                      },
                      "children": [
                        {
                          "type": "Section",
                          "props": {
                            "title": "Frankenstein"
                          },
                          "children": [
                            {
                              "type": "Row",
                              "props": {},
                              "children": [
                                {
                                  "type": "Text",
                                  "props": {
                                    "tone": "dim"
                                  },
                                  "children": [
                                    "by ",
                                    "Mary Shelley",
                                    " · ",
                                    "£6.99"
                                  ]
                                }
                              ]
                            },
                            {
                              "type": "Row",
                              "props": {},
                              "children": [
                                {
                                  "type": "Button",
                                  "props": {
                                    "intent": "add",
                                    "label": "Add to cart",
                                    "hotkey": "a",
                                    "command": [
                                      "add"
                                    ]
                                  },
                                  "children": []
                                },
                                {
                                  "type": "Button",
                                  "props": {
                                    "intent": "close",
                                    "label": "Close",
                                    "hotkey": "x",
                                    "command": [
                                      "close"
                                    ]
                                  },
                                  "children": []
                                }
                              ]
                            },
                            {
                              "type": "Tabs",
                              "props": {
                                "tabs": [
                                  {
                                    "key": "details",
                                    "label": "Details",
                                    "active": true,
                                    "command": [
                                      "tab",
                                      "details"
                                    ]
                                  },
                                  {
                                    "key": "reviews",
                                    "label": "Reviews",
                                    "active": false,
                                    "command": [
                                      "tab",
                                      "reviews"
                                    ]
                                  }
                                ]
                              },
                              "children": [
                                {
                                  "type": "Scope",
                                  "props": {
                                    "page": "details"
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
                                        ]
                                      },
                                      "children": []
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "text": "Bookshop  [cart: 1]\n\nSearch: title, author or genre▏ (search --query …)\n\n────────────────────────────────────────────────\n\nShelf: gothic\n3 books\n\n   title              author        price\n1. Dracula            Bram Stoker   £8.25\n2. Frankenstein       Mary Shelley  £6.99\n3. Wuthering Heights  Emily Brontë  £7.25\n\nFrankenstein\nby Mary Shelley · £6.99\n[a] Add to cart  [x] Close\n[1 Details]  2 Reviews \n────────────────────────────────────────────────\nGenre  gothic\nPrice  £6.99\nStock  9\n\nadd [qty] · close · tab <name> · open <row>",
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
        "name": "close",
        "page": "book",
        "usage": "close",
        "description": "back to the shelf",
        "kind": "navigate",
        "available": true
      },
      {
        "name": "tab",
        "page": "book",
        "usage": "tab <name>",
        "description": "switch tab: details, reviews",
        "kind": "navigate",
        "args": {
          "type": "object",
          "required": [
            "name"
          ],
          "properties": {
            "name": {
              "description": "details | reviews",
              "type": "string"
            }
          }
        },
        "available": true
      },
      {
        "name": "open",
        "page": "shelf",
        "usage": "open <row>",
        "description": "open the nth book on this shelf",
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
        "label": "Dracula · Bram Stoker · £8.25",
        "command": [
          "open",
          "1"
        ]
      },
      {
        "kind": "row",
        "label": "Frankenstein · Mary Shelley · £6.99",
        "command": [
          "open",
          "2"
        ]
      },
      {
        "kind": "row",
        "label": "Wuthering Heights · Emily Brontë · £7.25",
        "command": [
          "open",
          "3"
        ]
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
        "label": "Close",
        "command": [
          "close"
        ]
      },
      {
        "kind": "tab",
        "label": "Details (active)",
        "command": [
          "tab",
          "details"
        ]
      },
      {
        "kind": "tab",
        "label": "Reviews",
        "command": [
          "tab",
          "reviews"
        ]
      }
    ]
  },
  "pending": [
    {
      "id": 5,
      "at": "2026-10-20T17:31:01.183Z",
      "actor": "agent",
      "sid": "41914a7c",
      "kind": "propose",
      "page": "cart",
      "intent": "checkout",
      "action": "order.place",
      "input": {}
    }
  ],
  "error": null
} as const
