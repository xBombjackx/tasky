const STREAMER_SCHEMA = {
  name: "Streamer Tasks",
  properties: {
    Task: {
      title: {},
    },
    Status: {
      status: {
        options: [
          { name: "Not started", color: "default" },
          { name: "In progress", color: "blue" },
          { name: "Done", color: "green" },
        ],
        groups: [
          { name: "To-do", color: "gray", option_ids: ["Not started"] },
          { name: "In progress", color: "blue", option_ids: ["In progress"] },
          { name: "Complete", color: "green", option_ids: ["Done"] },
        ],
      },
    },
    Completed: {
      checkbox: {},
    },
  },
};

const VIEWER_SCHEMA = {
  name: "Viewer Tasks",
  properties: {
    Task: {
      title: {},
    },
    "Suggested by": {
      rich_text: {},
    },
    "Approval Status": {
      select: {
        options: [
          { name: "Pending", color: "yellow" },
          { name: "Approved", color: "green" },
          { name: "Rejected", color: "red" },
        ],
      },
    },
    Role: {
      select: {
        options: [
          { name: "Viewer", color: "gray" },
          { name: "SubscriberT3", color: "blue" },
          { name: "SubscriberT2", color: "purple" },
          { name: "SubscriberT1", color: "red" },
          { name: "Moderator", color: "brown" },
          { name: "VIP", color: "yellow" },
        ],
      },
    },
    Status: {
      status: {
        options: [
          { name: "Not started", color: "default" },
          { name: "Rejected", color: "red" },
          { name: "Approved", color: "green" },
          { name: "Pending", color: "yellow" },
          { name: "Done", color: "green" },
        ],
        groups: [
          {
            name: "To-do",
            color: "gray",
            option_ids: ["Not started", "Rejected", "Approved"],
          },
          { name: "In progress", color: "blue", option_ids: ["Pending"] },
          { name: "Complete", color: "green", option_ids: ["Done"] },
        ],
      },
    },
    Completed: {
      checkbox: {},
    },
  },
};

module.exports = {
  STREAMER_SCHEMA,
  VIEWER_SCHEMA,
};
