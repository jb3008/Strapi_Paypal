'use strict';

const { has, pipe, prop, pick } = require('lodash/fp');
const { MANY_RELATIONS } = require('strapi-utils').relations.constants;
const { setCreatorFields } = require('strapi-utils');

const { getService, wrapBadRequest, pickWritableAttributes } = require('../utils');
const { validateBulkDeleteInput, validatePagination } = require('./validation');
var request = require('request');
var client_id = 'AepdB8_HosPoGFsMBzro0eV-1hTYZBLc2MWLnyJlSGq5UZk431qCQ7mca4OJNEVabIM3Y5nuexsdNOiR';
var secret = 'EAMEKnr0EpTHAZSFrP3HI9l-bqidkcCWfT0Qs-VzTU2QrdF-_GSwzfJHVUIIs06QvuaPV-xIyaDTOJ5U';
module.exports = {
    async find(ctx) {
        const { userAbility } = ctx.state;
        const { model } = ctx.params;
        const { query } = ctx.request;

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.read()) {
            return ctx.forbidden();
        }

        const method = has('_q', query) ? 'searchWithRelationCounts' : 'findWithRelationCounts';

        const permissionQuery = permissionChecker.buildReadQuery(query);

        const { results, pagination } = await entityManager[method](permissionQuery, model);

        ctx.body = {
            results: results.map(entity => permissionChecker.sanitizeOutput(entity)),
            pagination,
        };
    },

    async findOne(ctx) {
        const { userAbility } = ctx.state;
        const { model, id } = ctx.params;

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.read()) {
            return ctx.forbidden();
        }

        const entity = await entityManager.findOneWithCreatorRoles(id, model);

        if (!entity) {
            return ctx.notFound();
        }

        if (permissionChecker.cannot.read(entity)) {
            return ctx.forbidden();
        }

        ctx.body = permissionChecker.sanitizeOutput(entity);
    },

    async create(ctx) {
        const { userAbility, user } = ctx.state;
        const { model } = ctx.params;
        const { body } = ctx.request;

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.create()) {
            return ctx.forbidden();
        }

        const pickWritables = pickWritableAttributes({ model });
        const pickPermittedFields = permissionChecker.sanitizeCreateInput;
        const setCreator = setCreatorFields({ user });

        const sanitizeFn = pipe([pickWritables, pickPermittedFields, setCreator]);

        await wrapBadRequest(async() => {
            if (ctx.request.url.indexOf("product.product") != -1) {
                let body_plan = sanitizeFn(body);
                const paypalId = await paypalProductCreate(body_plan);
                body_plan.PaypalProductId = paypalId;
                const entity = await entityManager.create(body_plan, model);
                ctx.body = permissionChecker.sanitizeOutput(entity);
                await strapi.telemetry.send('didCreateFirstContentTypeEntry', { model });
            } else if (ctx.request.url.indexOf("plan.plan") != -1) {
                let body_plan = sanitizeFn(body);
                const paypalId = await paypalCreate(body_plan);
                console.log(">>>>>>>>>>>", paypalId)

                body_plan.paypalPlanId = paypalId;
                console.log(body_plan)
                const entity = await entityManager.create(body_plan, model);
                ctx.body = permissionChecker.sanitizeOutput(entity);
                await strapi.telemetry.send('didCreateFirstContentTypeEntry', { model });
            } else {
                const entity = await entityManager.create(sanitizeFn(body), model);
                ctx.body = permissionChecker.sanitizeOutput(entity);

                await strapi.telemetry.send('didCreateFirstContentTypeEntry', { model });
            }
        })();
    },

    async update(ctx) {
        const { userAbility, user } = ctx.state;
        const { id, model } = ctx.params;
        const { body } = ctx.request;

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.update()) {
            return ctx.forbidden();
        }

        const entity = await entityManager.findOneWithCreatorRoles(id, model);

        if (!entity) {
            return ctx.notFound();
        }

        if (permissionChecker.cannot.update(entity)) {
            return ctx.forbidden();
        }

        const pickWritables = pickWritableAttributes({ model });
        const pickPermittedFields = permissionChecker.sanitizeUpdateInput(entity);
        const setCreator = setCreatorFields({ user, isEdition: true });

        const sanitizeFn = pipe([pickWritables, pickPermittedFields, setCreator]);

        await wrapBadRequest(async() => {
            if (ctx.request.url.indexOf("product.product") != -1) {
                const paypalId = await PaypalProductUpdate(sanitizeFn(body), false);
                const updatedEntity = await entityManager.update(entity, sanitizeFn(body), model);
                ctx.body = permissionChecker.sanitizeOutput(updatedEntity);
            } else {
                const updatedEntity = await entityManager.update(entity, sanitizeFn(body), model);

                ctx.body = permissionChecker.sanitizeOutput(updatedEntity);
            }
        })();
    },

    async delete(ctx) {
        const { userAbility } = ctx.state;
        const { id, model } = ctx.params;

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.delete()) {
            return ctx.forbidden();
        }

        const entity = await entityManager.findOneWithCreatorRoles(id, model);

        if (!entity) {
            return ctx.notFound();
        }

        if (permissionChecker.cannot.delete(entity)) {
            return ctx.forbidden();
        }
        if (ctx.request.url.indexOf("product.product") != -1) {
            const entity = await strapi.services.product.findOne({ id });
            const paypalId = await PaypalProductUpdate(entity, true);
        }
        const result = await entityManager.delete(entity, model);

        ctx.body = permissionChecker.sanitizeOutput(result);
    },

    async publish(ctx) {
        const { userAbility } = ctx.state;
        const { id, model } = ctx.params;

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.publish()) {
            return ctx.forbidden();
        }

        const entity = await entityManager.findOneWithCreatorRoles(id, model);

        if (!entity) {
            return ctx.notFound();
        }

        if (permissionChecker.cannot.publish(entity)) {
            return ctx.forbidden();
        }

        const result = await entityManager.publish(entity, model);

        ctx.body = permissionChecker.sanitizeOutput(result);
    },

    async unpublish(ctx) {
        const { userAbility } = ctx.state;
        const { id, model } = ctx.params;

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.unpublish()) {
            return ctx.forbidden();
        }

        const entity = await entityManager.findOneWithCreatorRoles(id, model);

        if (!entity) {
            return ctx.notFound();
        }

        if (permissionChecker.cannot.unpublish(entity)) {
            return ctx.forbidden();
        }

        const result = await entityManager.unpublish(entity, model);

        ctx.body = permissionChecker.sanitizeOutput(result);
    },

    async bulkDelete(ctx) {
        const { userAbility } = ctx.state;
        const { model } = ctx.params;
        const { query, body } = ctx.request;
        const { ids } = body;

        await validateBulkDeleteInput(body);

        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.delete()) {
            return ctx.forbidden();
        }

        const permissionQuery = permissionChecker.buildDeleteQuery(query);

        const idsWhereClause = {
            [`id_in`]: ids
        };
        const params = {
            ...permissionQuery,
            _where: [idsWhereClause].concat(permissionQuery._where || {}),
        };

        const results = await entityManager.findAndDelete(params, model);

        ctx.body = results.map(result => permissionChecker.sanitizeOutput(result));
    },

    async previewManyRelations(ctx) {
        const { userAbility } = ctx.state;
        const { model, id, targetField } = ctx.params;
        const { pageSize = 10, page = 1 } = ctx.request.query;

        validatePagination({ page, pageSize });

        const contentTypeService = getService('content-types');
        const entityManager = getService('entity-manager');
        const permissionChecker = getService('permission-checker').create({ userAbility, model });

        if (permissionChecker.cannot.read()) {
            return ctx.forbidden();
        }

        const modelDef = strapi.getModel(model);
        const assoc = modelDef.associations.find(a => a.alias === targetField);

        if (!assoc || !MANY_RELATIONS.includes(assoc.nature)) {
            return ctx.badRequest('Invalid target field');
        }

        const entity = await entityManager.findOneWithCreatorRoles(id, model);

        if (!entity) {
            return ctx.notFound();
        }

        if (permissionChecker.cannot.read(entity, targetField)) {
            return ctx.forbidden();
        }

        let relationList;
        if (assoc.nature === 'manyWay') {
            const populatedEntity = await entityManager.findOne(id, model, [targetField]);
            const relationsListIds = populatedEntity[targetField].map(prop('id'));
            relationList = await entityManager.findPage({ page, pageSize, id_in: relationsListIds },
                assoc.targetUid
            );
        } else {
            const assocModel = strapi.db.getModelByAssoc(assoc);
            relationList = await entityManager.findPage({ page, pageSize, [`${assoc.via}.${assocModel.primaryKey}`]: entity.id },
                assoc.targetUid
            );
        }

        const config = await contentTypeService.findConfiguration({ uid: model });
        const mainField = prop(['metadatas', assoc.alias, 'edit', 'mainField'], config);

        ctx.body = {
            pagination: relationList.pagination,
            results: relationList.results.map(pick(['id', modelDef.primaryKey, mainField])),
        };
    },
};


//#region  Paypal 
async function paypalProductCreate(obj) {
    return new Promise(resolve => {
        var options = {
            'method': 'POST',
            'url': 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            auth: {
                user: client_id,
                password: secret
            },
            form: {
                'grant_type': 'client_credentials'
            }
        };
        request(options, function(error, response) {
            if (error) {
                resolve(null);
            } else {
                console.log(obj)

                let objData = {
                    "name": obj.name,
                    "description": obj.description,
                    "type": "SERVICE",
                    "category": "SOFTWARE",
                    "image_url": obj.image_url,
                    "home_url": obj.home_url
                }
                var options = {
                    'method': 'POST',
                    'url': 'https://api-m.sandbox.paypal.com/v1/catalogs/products',
                    'headers': {
                        'PayPal-Request-Id': obj.ProductId,
                        'Authorization': 'Bearer ' + JSON.parse(response.body).access_token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(objData)

                };
                request(options, function(error, response) {


                    if (error) { resolve(null); } else {
                        console.log(response)
                        resolve(JSON.parse(response.body).id)
                    }
                });
            }

        });
    })
}

async function PaypalProductUpdate(obj, flg) {
    return new Promise(resolve => {
        var options = {
            'method': 'POST',
            'url': 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            auth: {
                user: client_id,
                password: secret
            },
            form: {
                'grant_type': 'client_credentials'
            }
        };
        request(options, function(error, response) {
            if (error) {
                resolve(null);
            } else {
                let param = [];
                if (!flg) {
                    if (obj.description) {
                        param.push({

                            "op": "replace",
                            "path": "/description",
                            "value": obj.description

                        })
                    }
                    if (obj.category) {
                        param.push({

                            "op": "replace",
                            "path": "/category",
                            "value": "SOFTWARE"

                        })
                    }
                    if (obj.image_url) {
                        param.push({

                            "op": "replace",
                            "path": "/image_url",
                            "value": obj.image_url

                        })
                    }
                    if (obj.home_url) {
                        param.push({

                            "op": "replace",
                            "path": "/home_url",
                            "value": obj.image_url

                        })
                    }
                } else {
                    param = [{
                        op: 'replace',
                        path: '/',
                        value: {
                            state: 'ACTIVE'
                        }
                    }];
                }
                var options = {
                    'method': 'PATCH',
                    'url': 'https://api-m.sandbox.paypal.com/v1/catalogs/products/' + obj.PaypalProductId,
                    'headers': {
                        'Authorization': 'Bearer ' + JSON.parse(response.body).access_token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(param)

                };
                request(options, function(error, response) {
                    if (error) { resolve(null); } else {
                        resolve('ok');
                    }
                });
            }

        });
    })
}


async function paypalCreate(obj) {
    const idProduct = obj.Product_id;
    const entity_product = await strapi.services.product.findOne({ idProduct });
    let body = {
        "product_id": entity_product.PaypalProductId,
        "name": obj.name,
        "description": obj.description,
        "billing_cycles": [{
                "frequency": {
                    "interval_unit": "MONTH",
                    "interval_count": obj.interval_count
                },
                "tenure_type": "TRIAL",
                "sequence": 1,
                "total_cycles": 1
            },
            {
                "frequency": {
                    "interval_unit": "MONTH",
                    "interval_count": 1
                },
                "tenure_type": "REGULAR",
                "sequence": 2,
                "total_cycles": 12,
                "pricing_scheme": {
                    "fixed_price": {
                        "value": parseFloat(obj.fixed_price).toFixed(2),
                        "currency_code": "USD"
                    }
                }
            }
        ],
        "payment_preferences": {
            "auto_bill_outstanding": true,
            "setup_fee": {
                "value": "10",
                "currency_code": "USD"
            },
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 3
        },
        "taxes": {
            "percentage": obj.taxes,
            "inclusive": false
        }

    }
    return new Promise(async resolve => {
        var options = {
            'method': 'POST',
            'url': 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            auth: {
                user: client_id,
                password: secret
            },
            form: {
                'grant_type': 'client_credentials'
            }
        };
        request(options, function(error, response) {
            console.log(error)
            if (error) {
                resolve(null);
            } else {
                var options = {
                    'method': 'POST',
                    'url': 'https://api-m.sandbox.paypal.com/v1/billing/plans',
                    'headers': {
                        'PayPal-Request-Id': obj.PlanId,
                        'Authorization': 'Bearer ' + JSON.parse(response.body).access_token,
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify(body)

                };
                request(options, function(error, response) {
                    console.log(error, response)
                    if (error) {
                        resolve(null);
                    } else {
                        resolve(JSON.parse(response.body).id)
                    }

                });
            }

        });
    })
}

async function PlandeActive() {

}
//#endregion