const CONFIG = {
	namespace: "$app:discount-config",
	key: "function-configuration",
	type: "json",
};

export async function getCurrentAppInstallation({ admin }) {
  const response = await admin.graphql(
    `#graphql
      query getCurrentAppInstallation {
        currentAppInstallation {
          id
          app {
            id
            title
            handle
          }
          accessScopes {
            handle
          }
        }
      }
    `
  );

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(
      json.errors.map((error) => error.message).join("; ")
    );
  }

  const installation = json.data?.currentAppInstallation;

  if (!installation) {
    throw new Error("Not found app data instalations.");
  }

  return installation;
}

export async function getDiscountShopifyFunctions({ admin }) {
	const response = await admin.graphql(
		`#graphql
			query GetShopifyFunctions($apiType: String!) {
				shopifyFunctions(first: 250, apiType: $apiType) {
					nodes {
						# id
						title
						description
						apiType
						# apiVersion
						handle
						app {
							# title
							handle
							# id
						}
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		`,
		{
			variables: { apiType: "discount" },
		}
	);

	const json = await response.json();

	return json.data.shopifyFunctions;
}

export async function getDiscountsList({ admin, pageSize = 20, after }) {
	const response = await admin.graphql(
		`#graphql
			query DiscountsList($first: Int!, $after: String) {
				discountNodes(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
					nodes {
						id
						discount {
							__typename
							... on DiscountAutomaticApp {
								discountId
								title
								status
								startsAt
								endsAt
								asyncUsageCount
								context {
									__typename
								}
								appliesOnOneTimePurchase
								appDiscountType {
									title
									discountClasses
								}
							}
						}
					}
					pageInfo {
						hasNextPage
						endCursor
					}
				}
			}
		`,
		{
			variables: {
				first: pageSize,
				after,
			},
		},
	);

	const json = await response.json();
	const discountNodes = json.data?.discountNodes;
	const discountList = discountNodes?.nodes ?? [];

	const discounts = discountList
		.filter((node) => Boolean(node?.discount.title))
		.map((node) => {
			const discount = node.discount;
			const isCode = discount.__typename?.includes("Code");

			return {
				id: node.id,
				legacyResourceId: String(node.id).replace("gid://shopify/DiscountAutomaticNode/", ""),
				title: discount.title || "Untitled discount",
				method: isCode ? "Code" : "Automatic",
				status: discount.status ?? "EXPIRED",
				type: discount.appDiscountType?.title ?? "Discount App",
				usageCount: typeof discount.asyncUsageCount === "number" ? discount.asyncUsageCount : 0,
			};
		});

	return {
		discounts,
		hasNextPage: discountNodes?.pageInfo?.hasNextPage ?? false,
		endCursor: discountNodes?.pageInfo?.endCursor ?? null,
	};
}

export async function getDiscountById({ admin, id = null }) {
	const response = await admin.graphql(
		`#graphql
			query DiscountById($id: ID!) {
				discountNode(id: $id) {
					id

					configuration: metafield(
						namespace: "$app:discount-config"
						key: "function-configuration"
					) {
						id
						namespace
						key
						type
						value
					}

					discount {
						... on DiscountAutomaticApp {
							discountId
							title
							status
							startsAt
							endsAt
							asyncUsageCount
							context {
								__typename
							}
							appliesOnOneTimePurchase
							appDiscountType {
								title
								discountClasses
							}
						}
					}
				}
			}
		`,
		{
			variables: { id },
		}
	);

	const json = await response.json();
	const configuration = JSON.parse(json.data?.discountNode?.configuration.value);
	const discount = json.data?.discountNode?.discount;

	return { discount, configuration };
}

export async function setMetafield({ admin, ownerId, value }) {
	const metafieldValue = buildMetafieldPayload({ payload: value });

	const response = await admin.graphql(
		`#graphql
			mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
				metafieldsSet(metafields: $metafields) {
					metafields {
						id
						namespace
						key
						type
						value
					}

					userErrors {
						field
						message
						code
					}
				}
			}
		`,
		{
			variables: {
				metafields: [
					{
						ownerId: ownerId,
						namespace: CONFIG.namespace,
						key: CONFIG.key,
						type: CONFIG.type,
						value: JSON.stringify(metafieldValue),
					},
				],
			},
		},
	);

	const data = await response.json();
	const errors = data.data.metafieldsSet.userErrors;

	if (errors.length > 0) {
		throw new Error(errors.map((error) => error.message).join(", "));
	}

	return data.data.metafieldsSet.metafields[0];
}

export async function createDiscountAutomaticApp({ admin, input }) {
	const metafieldValue = buildMetafieldPayload({ payload: input });
	const response = await admin.graphql(
		`#graphql
			mutation createDiscountAutomaticApp($automaticAppDiscount: DiscountAutomaticAppInput!) {
				discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
					userErrors {
						field
						message
					}
					automaticAppDiscount {
						discountId
						title
						startsAt
						endsAt
						status
						appDiscountType {
							appKey
							functionId
						}
						combinesWith {
							orderDiscounts
							productDiscounts
							shippingDiscounts
						}
					}
				}
			}
		`,
		{
			variables: {
				automaticAppDiscount: {
					title: input["discount-title"],
					functionHandle: "discount-bulk-buy-tier",
					discountClasses: ["PRODUCT"],
					startsAt: new Date().toISOString(),
					combinesWith: {
						orderDiscounts: false,
						productDiscounts: false,
						shippingDiscounts: false,
					},
					metafields: [
						{
							namespace: CONFIG.namespace,
							key: CONFIG.key,
							type: CONFIG.type,
							value: JSON.stringify(metafieldValue),
						},
					],
				},
			},
		},
	);
	const json = await response.json();
	if (json.errors?.length) {
		throw new Error(json.errors.map((error) => error.message).join(", "));
	}
	const errors = json.data.discountAutomaticAppCreate.userErrors;

	if (errors.length > 0) {
		throw new Error(errors.map((error) => error.message).join(", "));
	}

	return json.data;
}

export async function deleteDiscountAutomatic({ admin, id }) {
	const response = await admin.graphql(
		`#graphql
			mutation deleteDiscountAutomatic($id: ID!) {
				discountAutomaticDelete(id: $id) {
					deletedAutomaticDiscountId
					userErrors {
						field
						code
						message
					}
				}
			}
		`,
		{
			variables: {
				id: id,
			},
		},
	);
	const json = await response.json();
	const errors = json.data.discountAutomaticDelete.userErrors;

	if (errors.length > 0) {
		throw new Error(errors.map((error) => error.message).join(", "));
	}

	return json.data;
}

export async function getCollectionsByIds({ admin, ids }) {
  if (!Array.isArray(ids)) {
    throw new TypeError("ids must be an array.");
  }

  if (!ids.length) return [];

  const collectionIds = [...new Set(
    ids.map((id) => {
      const value = String(id);

      return value.startsWith("gid://shopify/Collection/")
        ? value
        : `gid://shopify/Collection/${value}`;
    })
  )];

  const collections = [];

  for (let i = 0; i < collectionIds.length; i += 250) {
    const response = await admin.graphql(
      `#graphql
        query GetCollectionsByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Collection {
              id
              title
              image {
                url
                altText
                width
                height
              }
              productsCount {
                count
                precision
              }
            }
          }
        }
      `,
      {
        variables: {
          ids: collectionIds.slice(i, i + 250),
        },
      }
    );

    const json = await response.json();

    if (json.errors?.length) {
      throw new Error(
        json.errors.map((error) => error.message).join("; ")
      );
    }

    if (!Array.isArray(json.data?.nodes)) {
      throw new Error("Respons collection tidak valid.");
    }

    for (const node of json.data.nodes) {
      if (!node?.id) continue;

      collections.push({
        id: node.id,
        title: node.title,
        image: node.image,
        totalProducts: node.productsCount?.count ?? null,
        countPrecision: node.productsCount?.precision ?? null,
      });
    }
  }

  return collections;
}

export async function getProductsByIds({ admin, ids }) {
  if (!Array.isArray(ids)) {
    throw new TypeError("ids harus berupa array.");
  }

  if (!ids.length) return [];

  const productIds = [...new Set(
    ids.map((id) => {
      const value = String(id);

      return value.startsWith("gid://shopify/Product/")
        ? value
        : `gid://shopify/Product/${value}`;
    })
  )];

  const products = [];

  for (let i = 0; i < productIds.length; i += 250) {
    const response = await admin.graphql(
      `#graphql
        query GetProductsByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              featuredMedia {
								preview {
									image {
										url
										altText
										width
										height
									}
								}
              }
              variantsCount {
                count
                precision
              }
            }
          }
        }
      `,
      {
        variables: {
          ids: productIds.slice(i, i + 250),
        },
      }
    );

    const json = await response.json();

    if (json.errors?.length) {
      throw new Error(
        json.errors.map((error) => error.message).join("; ")
      );
    }

    if (!Array.isArray(json.data?.nodes)) {
      throw new Error("Respons product tidak valid.");
    }

    for (const node of json.data.nodes) {
      if (!node?.id) continue;

      products.push({
        id: node.id,
        title: node.title,
        image: node.featuredMedia?.preview?.image ?? null,
        totalVariants: node.variantsCount?.count ?? null,
        countPrecision: node.variantsCount?.precision ?? null,
      });
    }
  }

  return products;
}


function buildMetafieldPayload({ payload }) {
	const data = {
		id: payload["discount-id"],
		title: payload["discount-title"],
		type: {
			title: payload["discount-type"],
			value: payload[`discount-type-${payload["discount-type"]}-value`],
		},
		target: {
			title: payload["discount-target"],
			value: (payload[`discount-target-${payload["discount-target"]}s[]`] ?? "")
				.split(",")
				.filter(Boolean),
		},
		requirement: {
			title: payload["discount-requirement"],
			value:
				payload[
					`discount-requirement-${payload["discount-requirement"]}-value`
				] ?? null,
		},
		resources: JSON.parse(payload["discount-resources"] || "[]"),
	};

	if (payload["discount-target"] === "collection") {
		data.collectionIds =
			(payload[`discount-target-${payload["discount-target"]}s[]`] ?? "")
				.split(",")
				.filter(Boolean);
	}

	if (payload["discount-target"] === "product") {
		data.productIds =
			(payload[`discount-target-${payload["discount-target"]}s[]`] ?? "")
				.split(",")
				.filter(Boolean);
	}

	if (payload["discount-type"] === "percentage") {
		data.value = {
			percentage: {
				value: parseFloat(
					payload[`discount-type-${payload["discount-type"]}-value`],
				),
			},
		};
	}

	if (payload["discount-type"] === "amount") {
		data.value = {
			fixedAmount: {
				amount: parseFloat(
					payload[`discount-type-${payload["discount-type"]}-value`],
				),
				appliesToEachItem: false,
			},
		};
	}

	return data;
}

//////////////////////////// service

export async function getDiscountTypeList({ admin }) {
	const appInstallation = await getCurrentAppInstallation({ admin });
	const discountFunctions = await getDiscountShopifyFunctions({ admin });
	const discountTypeList = discountFunctions.nodes.filter(
		discount => discount.app?.handle === appInstallation.app?.handle
	);

	return discountTypeList;
}

export async function getSelectedDiscountFunctionsByHandle({ admin, handle }) {
	const discountFunctions = await getDiscountShopifyFunctions({ admin });
	return discountFunctions.nodes.filter(
		discount => discount?.handle === handle
	);
}