// CAM Studio report formatting for the Google Apps Script web app.
// Returns text data to the extension; no browser APIs are used.
function renderCamReport(camData) {
    /*
     * =========================================================
     * BTJ HELPERS
     * =========================================================
     */

    function getProperties(object) {

        const data =
            object?.message?.data;

        return Array.isArray(data)
            ? data
            : [];
    }


    function getProperty(object, name) {

        const entry =
            getProperties(object).find(
                item => item?.key === name
            );

        return entry
            ? entry.value
            : undefined;
    }


    function unwrap(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }


        if (
            value.message &&
            Object.prototype.hasOwnProperty.call(
                value.message,
                "value"
            )
        ) {
            return value.message.value;
        }


        if (
            value.message &&
            Array.isArray(value.message.data)
        ) {
            return value.message.data;
        }


        return value;
    }


    function getSimple(object, name) {

        return unwrap(
            getProperty(object, name)
        );
    }


    function btjToJS(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }


        if (
            value.message &&
            Object.prototype.hasOwnProperty.call(
                value.message,
                "value"
            )
        ) {
            return value.message.value;
        }


        const data =
            value?.message?.data;


        if (Array.isArray(data)) {

            const isObject =
                data.every(
                    item =>
                        item &&
                        typeof item === "object" &&
                        Object.prototype.hasOwnProperty.call(
                            item,
                            "key"
                        ) &&
                        Object.prototype.hasOwnProperty.call(
                            item,
                            "value"
                        )
                );


            if (isObject) {

                const result = {};


                for (const item of data) {

                    result[item.key] =
                        btjToJS(
                            item.value
                        );
                }


                return result;
            }


            return data.map(
                item => btjToJS(item)
            );
        }


        if (Array.isArray(value)) {

            return value.map(
                item => btjToJS(item)
            );
        }


        return value;
    }


    /*
     * =========================================================
     * UNIT FORMATTING
     * =========================================================
     */

    function cleanNumber(
        number,
        decimals = 4
    ) {

        if (!Number.isFinite(number)) {
            return String(number);
        }


        return String(
            Number(
                number.toFixed(decimals)
            )
        );
    }


    function formatLength(value) {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return "(not found)";
        }


        const mm =
            Number(value);


        if (!Number.isFinite(mm)) {
            return String(value);
        }


        const inches =
            mm / 25.4;


        return (
            `${cleanNumber(inches, 4)} in ` +
            `(${cleanNumber(mm, 4)} mm)`
        );
    }


    function formatFeed(value) {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return "(not found)";
        }


        const mmPerMinute =
            Number(value);


        if (!Number.isFinite(mmPerMinute)) {
            return String(value);
        }


        const inchesPerMinute =
            mmPerMinute / 25.4;


        return (
            `${cleanNumber(inchesPerMinute, 3)} in/min ` +
            `(${cleanNumber(mmPerMinute, 3)} mm/min)`
        );
    }


    /*
     * =========================================================
     * DISPLAY HELPERS
     * =========================================================
     */

    function displayValue(value) {

        if (value === undefined) {
            return "(not found)";
        }

        if (value === null) {
            return "null";
        }

        if (typeof value === "boolean") {
            return value ? "Yes" : "No";
        }

        return String(value);
    }


    function addLine(
        lines,
        label,
        value,
        indent = "  "
    ) {

        if (value === undefined) {
            return;
        }


        lines.push(
            `${indent}${label}: ${displayValue(value)}`
        );
    }


    function addLength(
        lines,
        label,
        value,
        indent = "  "
    ) {

        if (value === undefined) {
            return;
        }


        lines.push(
            `${indent}${label}: ${formatLength(value)}`
        );
    }


    function addFeed(
        lines,
        label,
        value,
        indent = "  "
    ) {

        if (value === undefined) {
            return;
        }


        lines.push(
            `${indent}${label}: ${formatFeed(value)}`
        );
    }


    /*
     * =========================================================
     * CAM HIERARCHY
     * =========================================================
     */

    function buildHierarchy(operations) {

        const hierarchy = {

            machines: [],
            setups: []
        };


        let currentSetup =
            null;


        for (const operation of operations) {

            const type =
                getSimple(
                    operation,
                    "operationType"
                );


            const name =
                getSimple(
                    operation,
                    "name"
                ) || "(unnamed)";


            if (type === "Machine") {

                hierarchy.machines.push({

                    name,
                    object: operation
                });

                continue;
            }


            if (type === "Setup") {

                currentSetup = {

                    name,
                    object: operation,

                    tools: [],
                    toolpaths: []
                };


                hierarchy.setups.push(
                    currentSetup
                );

                continue;
            }


            if (
                type === "Tool" &&
                currentSetup
            ) {

                currentSetup.tools.push({

                    name,
                    object: operation
                });

                continue;
            }


            if (
                type === "ToolPath" &&
                currentSetup
            ) {

                currentSetup.toolpaths.push({

                    name,
                    object: operation
                });
            }
        }


        return hierarchy;
    }


    /*
     * =========================================================
     * MACHINE
     * =========================================================
     */

    function reportMachine(
        machine,
        lines
    ) {

        lines.push("");
        lines.push(
            `MACHINE: ${machine.name}`
        );

        const settings =
            btjToJS(
                getProperty(
                    machine.object,
                    "postSettings"
                )
            ) || {};


        if (settings.outputUnit === "Metric") {
            lines.push("  ✓ Output unit: Metric");
        } else if (settings.outputUnit === "Imperial") {
            lines.push("  ✕ Output unit: Imperial → Set to Metric");
        } else {
            lines.push("  ? Output unit: " +
                (settings.outputUnit === undefined ? "(not found)" : displayValue(settings.outputUnit)) +
                " → Verify in CAM Studio");
        }


    }


    /*
     * =========================================================
     * SETUP
     * =========================================================
     */

    function reportSetup(
        setup,
        lines
    ) {

        lines.push("");
        lines.push(
            `SETUP: ${setup.name}`
        );

        lines.push(
            "=============================="
        );


        const setupParameters =
            btjToJS(
                getProperty(
                    setup.object,
                    "setupParameters"
                )
            ) || {};


        lines.push(
            "  SETUP PARAMETERS"
        );


        addLine(
            lines,
            "Mating type",
            setupParameters.matingType,
            "    "
        );


        if (setupParameters.matingOffset) {

            addLength(
                lines,
                "Mating offset X",
                setupParameters.matingOffset.x,
                "    "
            );

            addLength(
                lines,
                "Mating offset Y",
                setupParameters.matingOffset.y,
                "    "
            );

            addLength(
                lines,
                "Mating offset Z",
                setupParameters.matingOffset.z,
                "    "
            );
        }


        if (setupParameters.postSettings) {

            addLine(
                lines,
                "Program number",
                setupParameters
                    .postSettings
                    .programNumber,
                "    "
            );
        }
    }


    /*
     * =========================================================
     * TOOL
     * =========================================================
     */

    function reportTool(
        tool,
        lines
    ) {

        lines.push("");
        lines.push(
            `  TOOL: ${tool.name}`
        );

        lines.push(
            "  ----------------------------"
        );


        const toolParameters =
            btjToJS(
                getProperty(
                    tool.object,
                    "toolParameters"
                )
            ) || {};


        const cutter =
            btjToJS(
                getProperty(
                    tool.object,
                    "cutter"
                )
            ) || {};


        addLine(
            lines,
            "Tool number",
            toolParameters.number,
            "    "
        );

        addLine(
            lines,
            "Cutter type",
            cutter.cutterType,
            "    "
        );

        addLine(
            lines,
            "Tool library unit",
            cutter.unit,
            "    "
        );

        addLength(
            lines,
            "Diameter",
            cutter.diameter,
            "    "
        );

        addLength(
            lines,
            "Cutting length",
            cutter.cuttingLength,
            "    "
        );

        addLength(
            lines,
            "Overall length",
            cutter.overallLength,
            "    "
        );

        addLine(
            lines,
            "Tool hand",
            cutter.toolHand,
            "    "
        );

        addLine(
            lines,
            "Point angle",
            cutter.angle,
            "    "
        );
    }


    /*
     * =========================================================
     * COMMON TOOLPATH SETTINGS
     * =========================================================
     */

    function reportCommonToolPath(
        parameters,
        lines
    ) {

        const custom =
            parameters.customParameters || {};

        const machining =
            parameters.machiningParameters || {};

        const post =
            custom.postParameters || {};

        const heights =
            custom.heightsParameters || {};

        const link =
            custom.linkParameters || {};


        lines.push("");
        lines.push(
            "    COMMON MACHINING"
        );


        addLine(
            lines,
            "Spindle speed",
            post.spindleSpeed,
            "      "
        );

        addLine(
            lines,
            "Coolant",
            post.coolantFlag,
            "      "
        );

        addLine(
            lines,
            "Air coolant",
            post.airCoolantFlag,
            "      "
        );

        addLine(
            lines,
            "Through-tool coolant",
            post.throughToolCoolantFlag,
            "      "
        );

        addFeed(
            lines,
            "Feed rate",
            machining.feedRate,
            "      "
        );

        addFeed(
            lines,
            "Entry feed rate",
            machining.entryRate,
            "      "
        );

        addFeed(
            lines,
            "Exit feed rate",
            machining.exitRate,
            "      "
        );

        addFeed(
            lines,
            "Plunge feed rate",
            machining.plungeFeedRate,
            "      "
        );

        addFeed(
            lines,
            "Retract feed rate",
            machining.retractFeedRate,
            "      "
        );

        addLength(
            lines,
            "Cut tolerance",
            machining.cutTolerance,
            "      "
        );


        lines.push("");
        lines.push(
            "    HEIGHTS"
        );


        addLine(
            lines,
            "Start height type",
            heights.startHeightType,
            "      "
        );

        addLength(
            lines,
            "Start height",
            heights.startHeight,
            "      "
        );

        addLine(
            lines,
            "End height type",
            heights.endHeightType,
            "      "
        );

        addLength(
            lines,
            "End height",
            heights.endHeight,
            "      "
        );


        lines.push("");
        lines.push(
            "    CLEARANCE"
        );


        addLine(
            lines,
            "Clearance height type",
            link.clearanceHeightType,
            "      "
        );

        addLength(
            lines,
            "Clearance height",
            link.clearanceHeight,
            "      "
        );
    }


    /*
     * =========================================================
     * HOLE MAKING
     * =========================================================
     */

    function reportHoleMaking(
        toolpath,
        parameters,
        lines
    ) {

        const machining =
            parameters.machiningParameters || {};


        const calculation =
            machining
                .calculationMethodsParameters || {};


        const holeMaking =
            calculation
                .holeMakingParameters || {};


        const strategy =
            holeMaking
                .holeMakingMainStrategy;


        lines.push("");
        lines.push(
            `  OPERATION: ${toolpath.name}`
        );

        lines.push(
            "  ----------------------------"
        );


        addLine(
            lines,
            "Method",
            calculation.method,
            "    "
        );

        addLine(
            lines,
            "Strategy",
            strategy,
            "    "
        );


        reportCommonToolPath(
            parameters,
            lines
        );


        lines.push("");
        lines.push(
            "    HOLE MAKING"
        );


        if (strategy === "Drilling") {

            const drilling =
                holeMaking
                    .holeMakingDrillingParameters || {};


            addLine(
                lines,
                "Pattern",
                drilling.pattern,
                "      "
            );

            addLength(
                lines,
                "Depth",
                drilling.depth,
                "      "
            );

            addLine(
                lines,
                "Surface first contact",
                drilling.surfaceFirstContactBasedFlag,
                "      "
            );

            addLength(
                lines,
                "Safe point distance",
                drilling.safePointDistance,
                "      "
            );

            addLength(
                lines,
                "Start/end point distance",
                drilling.startEndPointDistance,
                "      "
            );

            addLine(
                lines,
                "Ordering mode",
                drilling.orderingMode,
                "      "
            );

            addLine(
                lines,
                "Breakthrough",
                drilling.breaktroughFlag,
                "      "
            );


            if (
                drilling.breaktroughFlag === true
            ) {

                addLength(
                    lines,
                    "Breakthrough distance",
                    drilling.breaktroughDistance,
                    "      "
                );
            }


            addLine(
                lines,
                "Peck drilling",
                drilling.peckDrillFlag,
                "      "
            );


            if (
                drilling.peckDrillFlag === true
            ) {

                addLength(
                    lines,
                    "Peck depth",
                    drilling.peckDepth,
                    "      "
                );

                addLine(
                    lines,
                    "Full retract",
                    drilling.fullRetractFlag,
                    "      "
                );

                addLength(
                    lines,
                    "Minimum retract distance",
                    drilling.minRetractDistance,
                    "      "
                );
            }


            addLine(
                lines,
                "Dwell time",
                drilling.dwellTime,
                "      "
            );
        }
    }


    /*
     * =========================================================
     * WIREFRAME COMMON
     * =========================================================
     */

    function reportWireframeCommon(
        wireframe,
        lines
    ) {

        addLine(
            lines,
            "Cutting mode",
            wireframe.cuttingMode,
            "      "
        );

        addLine(
            lines,
            "Cutting side",
            wireframe.cuttingSide,
            "      "
        );

        addLine(
            lines,
            "Start position",
            wireframe.startFromPosition,
            "      "
        );

        addLine(
            lines,
            "Start corner",
            wireframe.startCornerMode,
            "      "
        );

        addLine(
            lines,
            "Reverse cutting order",
            wireframe.reverseCuttingOrderFlag,
            "      "
        );
    }


    /*
     * =========================================================
     * CUTTER COMPENSATION
     * =========================================================
     */

    function reportCompensation(
        wireframe,
        lines
    ) {

        const compensation =
            wireframe
                .cutterRadiusCompensationParameters || {};


        lines.push("");
        lines.push(
            "    CUTTER COMPENSATION"
        );


        addLine(
            lines,
            "Compensation type",
            compensation.compensationType,
            "      "
        );


        /*
         * Zero compensation radius / wear are not useful
         * active settings, so only show non-zero values.
         */

        if (
            compensation.compensationRadius !== undefined &&
            Number(compensation.compensationRadius) !== 0
        ) {

            addLength(
                lines,
                "Compensation radius",
                compensation.compensationRadius,
                "      "
            );
        }


        if (
            compensation.wearAmount !== undefined &&
            Number(compensation.wearAmount) !== 0
        ) {

            addLength(
                lines,
                "Wear amount",
                compensation.wearAmount,
                "      "
            );
        }
    }


    /*
     * =========================================================
     * TWO AXIS PROFILE
     * =========================================================
     */

    function reportTwoAxisProfile(
        wireframe,
        lines
    ) {

        lines.push("");
        lines.push(
            "    TWO AXIS PROFILE"
        );


        reportWireframeCommon(
            wireframe,
            lines
        );


        reportCompensation(
            wireframe,
            lines
        );


        /*
         * DEPTH STEPPING
         */

        const roughing =
            wireframe.roughingParameters || {};


        lines.push("");
        lines.push(
            "    DEPTH CONTROL"
        );


        addLine(
            lines,
            "Depth step enabled",
            roughing.depthStepFlag,
            "      "
        );


        /*
         * IMPORTANT:
         *
         * First/final/depth step values are only displayed
         * when depth stepping itself is enabled.
         */

        if (
            roughing.depthStepFlag === true
        ) {

            addLine(
                lines,
                "Depth step mode",
                roughing.depthStepMode,
                "      "
            );


            addLength(
                lines,
                "Depth step",
                roughing.depthStep,
                "      "
            );


            if (
                roughing.firstDepthStepFlag === true
            ) {

                addLength(
                    lines,
                    "First depth step",
                    roughing.firstDepthStep,
                    "      "
                );
            }


            if (
                roughing.finalDepthStepFlag === true
            ) {

                addLength(
                    lines,
                    "Final depth step",
                    roughing.finalDepthStep,
                    "      "
                );
            }
        }


        /*
         * PROFILE PASS
         */

        lines.push("");
        lines.push(
            "    PROFILE PASS"
        );


        addLine(
            lines,
            "Profile pass",
            wireframe.profilePassFlag,
            "      "
        );


        if (
            wireframe.profilePassFlag === true
        ) {

            addLength(
                lines,
                "Profile pass spacing",
                wireframe.profilePassSpacing,
                "      "
            );


            const profileComp =
                wireframe
                    .profilePassCutterRadiusCompensationParameters
                    || {};


            addLine(
                lines,
                "Profile compensation",
                profileComp.compensationType,
                "      "
            );


            if (
                profileComp.compensationRadius !== undefined &&
                Number(profileComp.compensationRadius) !== 0
            ) {

                addLength(
                    lines,
                    "Profile compensation radius",
                    profileComp.compensationRadius,
                    "      "
                );
            }


            if (
                profileComp.wearAmount !== undefined &&
                Number(profileComp.wearAmount) !== 0
            ) {

                addLength(
                    lines,
                    "Profile wear amount",
                    profileComp.wearAmount,
                    "      "
                );
            }
        }


        /*
         * TABS
         */

        lines.push("");
        lines.push(
            "    TABS"
        );


        addLine(
            lines,
            "Tabs",
            wireframe.tabsFlag,
            "      "
        );


        if (
            wireframe.tabsFlag === true
        ) {

            addLength(
                lines,
                "Tab width",
                wireframe.tabsWidth,
                "      "
            );

            addLength(
                lines,
                "Tab height",
                wireframe.tabsHeight,
                "      "
            );
        }
    }


    /*
     * =========================================================
     * TWO AXIS ROUGH
     * =========================================================
     */

    function reportTwoAxisRough(
        wireframe,
        lines
    ) {

        lines.push("");
        lines.push(
            "    TWO AXIS ROUGH"
        );


        reportWireframeCommon(
            wireframe,
            lines
        );


        addLine(
            lines,
            "Rough type",
            wireframe.roughType,
            "      "
        );


        reportCompensation(
            wireframe,
            lines
        );


        const roughing =
            wireframe.roughingParameters || {};


        lines.push("");
        lines.push(
            "    ROUGHING"
        );


        /*
         * Do not use operation NAME to determine this.
         * This function is reached only when JSON Pattern
         * is exactly TwoAxisRough.
         */


        addLine(
            lines,
            "Depth step enabled",
            roughing.depthStepFlag,
            "      "
        );


        if (
            roughing.depthStepFlag === true
        ) {

            addLine(
                lines,
                "Depth step mode",
                roughing.depthStepMode,
                "      "
            );

            addLength(
                lines,
                "Depth step",
                roughing.depthStep,
                "      "
            );


            if (
                roughing.firstDepthStepFlag === true
            ) {

                addLength(
                    lines,
                    "First depth step",
                    roughing.firstDepthStep,
                    "      "
                );
            }


            if (
                roughing.finalDepthStepFlag === true
            ) {

                addLength(
                    lines,
                    "Final depth step",
                    roughing.finalDepthStep,
                    "      "
                );
            }
        }


        /*
         * Only show offsets when they are actually non-zero.
         */

        if (
            roughing.roughingOffset !== undefined &&
            Number(roughing.roughingOffset) !== 0
        ) {

            addLength(
                lines,
                "Roughing offset",
                roughing.roughingOffset,
                "      "
            );
        }


        if (
            roughing.roughingRadialOffset !== undefined &&
            Number(roughing.roughingRadialOffset) !== 0
        ) {

            addLength(
                lines,
                "Radial offset",
                roughing.roughingRadialOffset,
                "      "
            );
        }


        if (
            roughing.roughingAxialOffset !== undefined &&
            Number(roughing.roughingAxialOffset) !== 0
        ) {

            addLength(
                lines,
                "Axial offset",
                roughing.roughingAxialOffset,
                "      "
            );
        }


        /*
         * TABS
         */

        lines.push("");
        lines.push(
            "    TABS"
        );


        addLine(
            lines,
            "Tabs",
            wireframe.tabsFlag,
            "      "
        );


        if (
            wireframe.tabsFlag === true
        ) {

            addLength(
                lines,
                "Tab width",
                wireframe.tabsWidth,
                "      "
            );

            addLength(
                lines,
                "Tab height",
                wireframe.tabsHeight,
                "      "
            );
        }
    }


    /*
     * =========================================================
     * WIREFRAME ROUTER
     * =========================================================
     */

    function reportWireframe(
        toolpath,
        parameters,
        lines
    ) {

        const machining =
            parameters.machiningParameters || {};


        const calculation =
            machining
                .calculationMethodsParameters || {};

		const wireframe =
			calculation
				.wireframeParameters || {};

        const pattern =
            wireframe.pattern;

        lines.push("");
        lines.push(
            `  OPERATION: ${toolpath.name}`
        );

        lines.push(
            "  ----------------------------"
        );


        addLine(
            lines,
            "Method",
            calculation.method,
            "    "
        );

        addLine(
            lines,
            "Pattern",
            pattern,
            "    "
        );


        reportCommonToolPath(
            parameters,
            lines
        );


        /*
         * IMPORTANT:
         *
         * Routing is based on the actual CAM JSON pattern.
         * The operation's user-editable name is ignored.
         */

        if (
            pattern === "TwoAxisProfile"
        ) {

            reportTwoAxisProfile(
                wireframe,
                lines
            );

            return;
        }


        if (
            pattern === "TwoAxisRough"
        ) {

            reportTwoAxisRough(
                wireframe,
                lines
            );

            return;
        }


        lines.push("");
        lines.push(
            "    WIREFRAME"
        );

        lines.push(
            `      Pattern parser not implemented: ${pattern}`
        );
    }


    /*
     * =========================================================
     * TOOLPATH ROUTER
     * =========================================================
     */

    function reportToolPath(
        toolpath,
        lines
    ) {

        const parameters =
            btjToJS(
                getProperty(
                    toolpath.object,
                    "toolPathParameters"
                )
            ) || {};


        const calculation =
            parameters
                ?.machiningParameters
                ?.calculationMethodsParameters || {};


        const method =
            calculation.method;


        if (
            method === "HoleMaking"
        ) {

            reportHoleMaking(
                toolpath,
                parameters,
                lines
            );

            return;
        }


        if (
            method === "Wireframe"
        ) {

            reportWireframe(
                toolpath,
                parameters,
                lines
            );

            return;
        }


        lines.push("");
        lines.push(
            `  OPERATION: ${toolpath.name}`
        );

        lines.push(
            "  ----------------------------"
        );


        addLine(
            lines,
            "Method",
            method || "(not identified)",
            "    "
        );


        lines.push(
            "    Parser not implemented for this method."
        );
    }


    /*
     * =========================================================
     * REPORT
     * =========================================================
     */

    function buildReport(
        jobName,
        hierarchy,
        bodyNames,
        stockDirectionType
    ) {

        const lines = [];


        lines.push(
            "CAM ACTIVE SETTINGS"
        );

        lines.push(
            "==================="
        );

        lines.push("Length: Inch (MM)  |  Feed: Inch/min (MM/min)");
        lines.push("");

        lines.push(
            `JOB: ${jobName}`
        );
        lines.push(
            `  Bodies: ${bodyNames.length ? bodyNames.join(", ") : "(none selected)"}`
        );
        addLine(lines, "Stock Direction Type", stockDirectionType, "  ");


        for (
            const machine
            of hierarchy.machines
        ) {

            reportMachine(
                machine,
                lines
            );
        }


        for (
            const setup
            of hierarchy.setups
        ) {

            reportSetup(
                setup,
                lines
            );


            for (
                const tool
                of setup.tools
            ) {

                reportTool(
                    tool,
                    lines
                );
            }


            for (
                const toolpath
                of setup.toolpaths
            ) {

                reportToolPath(
                    toolpath,
                    lines
                );
            }
        }


        return lines.join("\n");
    }



  const rootData = camData?.tree?.message?.data;
  if (!Array.isArray(rootData)) throw new Error("CAM root data was not found.");
  const jobsEntry = rootData.find(entry => entry?.key === "jobs");
  const jobs = jobsEntry?.value?.message?.data;
  if (!Array.isArray(jobs) || jobs.length === 0) throw new Error("No CAM jobs were found.");
  const components = btjToJS(getProperty(camData.tree, "components")) || [];
  return jobs.map(job => {
    const jobName = getSimple(job, "name") || "(unnamed job)";
    const selections = btjToJS(getProperty(job, "selectionParameters"))?.bodies?.associativeSelections || [];
    const bodyNames = selections.map(selection => {
      const component = components.find(item =>
        item._nodeId === selection.componentId || item.referenceId === selection.componentRef
      );
      return component?.name || "(unresolved body)";
    });
    const stockDirectionType = btjToJS(getProperty(job, "stock"))?.directionType;
    const operations = unwrap(getProperty(job, "operations"));
    if (!Array.isArray(operations)) throw new Error("Job operations array was not found.");
    return buildReport(jobName, buildHierarchy(operations), bodyNames, stockDirectionType);
  }).join("\n\n");
}
